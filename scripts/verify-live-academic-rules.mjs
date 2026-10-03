import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const accounts = JSON.parse(await readFile('.private/test-accounts.json', 'utf8'));
if (accounts.some(a => !/^qa\.[a-z]+\.20261002@example\.com$/.test(a.email))) throw new Error('Dedicated QA accounts required');
const byRole = Object.fromEntries(accounts.map(a => [a.role, a]));
const subject = 'da995757-05bf-4ca1-bfc1-80b601a018ac';
const auth = role => `RESET ROLE; SELECT set_config('request.jwt.claims','${JSON.stringify({ sub: byRole[role].authId, role: 'authenticated', app_metadata: { role } })}',true); SET LOCAL ROLE authenticated;`;
const expectDenied = sql => `DO $test$ BEGIN BEGIN ${sql}; RAISE EXCEPTION 'TEST_EXPECTED_DENIAL'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='TEST_EXPECTED_DENIAL' THEN RAISE; END IF; END; END $test$;`;
let test = `BEGIN;\n`;
if (process.env.VERIFY_RULES_MIGRATION) test += await readFile(process.env.VERIFY_RULES_MIGRATION, 'utf8');
for (const role of ['owner', 'coordinator', 'doctor', 'ta', 'student']) test += `${auth(role)} SELECT public.get_academic_schedule('cybersecurity','1');\n`;
test += `${auth('coordinator')} ${expectDenied("PERFORM public.get_academic_schedule('ai','1')")}`;
for (const role of ['doctor', 'ta', 'student']) test += `${auth(role)} ${expectDenied("PERFORM public.save_academic_settings('cybersecurity','1','{\"week_start_day\":5,\"start_time\":\"09:00\"}')")}`;
test += `${auth('owner')} SELECT public.save_academic_settings('cybersecurity','1','{"semester_start":null,"week_start_day":5,"days_off":[4,6],"start_time":"09:00"}');
SELECT public.save_academic_entry('cybersecurity','1','{"section":1,"day_index":5,"period":1,"subject_id":"${subject}","instructor_id":"${byRole.ta.profileId}","kind":"section","week_pattern":0,"uses_rotation":true,"lab_room":"معمل اختبار","hall_room":"قاعة اختبار","lab_week":1}');
${expectDenied(`PERFORM public.save_academic_entry('cybersecurity','1','{"section":1,"day_index":5,"period":1,"subject_id":"${subject}","kind":"lecture","week_pattern":1}')`)}
DO $test$ DECLARE before_count integer; BEGIN
 SELECT count(*) INTO before_count FROM public.academic_schedule_entries;
 BEGIN
  PERFORM public.import_academic_entries('cybersecurity','1',
   '[{"section":1,"day_index":5,"period":2,"subject_id":"${subject}","kind":"lecture","week_pattern":0},
     {"section":1,"day_index":5,"period":1,"subject_id":"${subject}","kind":"lecture","week_pattern":1}]');
  RAISE EXCEPTION 'IMPORT_MUST_FAIL';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='IMPORT_MUST_FAIL' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM public.academic_schedule_entries)<>before_count THEN RAISE EXCEPTION 'IMPORT_NOT_ATOMIC'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_academic_schedule('cybersecurity','1')->'subjects') s WHERE s->>'name'='Artificial Intelligence') THEN RAISE EXCEPTION 'LEGACY_SUBJECT_MISSING'; END IF;
 PERFORM public.assign_user_subjects('${byRole.doctor.profileId}', ARRAY['${subject}'::uuid, (SELECT id FROM public.subjects WHERE name='Artificial Intelligence' AND department='cybersecurity' LIMIT 1)]);
END $test$;
${auth('doctor')} SELECT public.create_lecture('${subject}','اختبار محاضرة قاعدة البيانات','lecture',null);
SELECT public.create_lecture((SELECT id FROM public.subjects WHERE name='Artificial Intelligence' AND department='cybersecurity' LIMIT 1),'اختبار المادة الثانية','lecture',null);
${expectDenied(`PERFORM public.create_lecture('${subject}','غير مصرح','section','1')`)}
${auth('ta')} SELECT public.create_lecture('${subject}','اختبار سكشن قاعدة البيانات','section','1');
${expectDenied(`PERFORM public.create_lecture('${subject}','غير مصرح','lecture',null)`)}
${auth('student')} ${expectDenied(`PERFORM public.create_lecture('${subject}','غير مصرح','lecture',null)`)}
${expectDenied(`INSERT INTO public.academic_schedule_entries(section,day_index,period,department,academic_year,subject_id,kind) VALUES(1,1,1,'cybersecurity','1','${subject}','lecture')`)}
${expectDenied(`INSERT INTO public.webauthn_credentials(auth_id,credential_id,public_key) VALUES('${byRole.student.authId}','fake','fake')`)}
${expectDenied('PERFORM 1 FROM public.webauthn_credentials')}
DO $test$ BEGIN
 IF (public.get_academic_schedule('cybersecurity','1')->'settings'->>'week_start_day')::int<>5 THEN RAISE EXCEPTION 'WEEK_START_FAILED'; END IF;
END $test$;
${auth('coordinator')}
DO $test$ BEGIN
 IF EXISTS(SELECT 1 FROM public.users WHERE auth_id<>auth.uid() AND role IN ('owner','coordinator')) THEN RAISE EXCEPTION 'COORDINATOR_RANK_VISIBILITY_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM public.error_reports WHERE department<>'cybersecurity') THEN RAISE EXCEPTION 'REPORT_SCOPE_FAILED'; END IF;
END $test$;
${expectDenied(`PERFORM public.get_user_subjects('${byRole.owner.profileId}')`)}
RESET ROLE;
SELECT 'academic rules and permissions passed; all changes rolled back' AS result;
ROLLBACK;
`;
await writeFile('.private/check-academic-migration.sql', test);
const result = spawnSync('supabase', ['db','query','--linked','--file','.private/check-academic-migration.sql','-o','json'], { encoding:'utf8', shell:process.platform==='win32' });
await writeFile('.private/academic-db-check-result.json', result.stdout);
if (result.status !== 0) { console.error(result.stderr); process.exitCode=1; } else console.log('Academic scope, session kinds, schedule conflicts and credential permissions passed; transaction rolled back.');
