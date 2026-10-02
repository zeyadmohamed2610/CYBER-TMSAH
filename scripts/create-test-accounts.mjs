// Credentials stay in the ignored .private directory; never print keys/passwords.
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const keys = JSON.parse(await readFile('.private/api-keys.json', 'utf8'));
const url = 'https://clfhllujvxhfvhenvwfz.supabase.co';
const key = keys.find(k => k.type === 'secret')?.api_key;
if (!key?.startsWith('sb_secret_')) throw new Error('Missing local secret key');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const roles = ['owner', 'coordinator', 'doctor', 'ta', 'student'];
const roleNames = { owner: 'المالك', coordinator: 'رئيس القسم', doctor: 'الدكتور', ta: 'المعيد', student: 'الطالب' };
const { data: existing, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
let accounts = [];
try { accounts = JSON.parse(await readFile('.private/test-accounts.json', 'utf8')); } catch { /* first run */ }
const { data: subject, error: subjectError } = await admin.from('subjects').upsert({
  id: 'da995757-05bf-4ca1-bfc1-80b601a018ac', name: 'مادة اختبار الحضور', doctor_name: 'دكتور الاختبار',
  department: 'cybersecurity', academic_year: '1',
}).select('id').single();
if (subjectError) throw subjectError;
for (const role of roles) {
  const email = `qa.${role}.20261002@example.com`;
  let account = accounts.find(a => a.role === role);
  if (!account) account = { role, email, username: `qa_${role}_20261002`, password: `Qa!${randomBytes(18).toString('base64url')}9a` };
  const user = existing.users.find(u => u.email === email);
  const payload = { email, password: account.password, email_confirm: true,
    app_metadata: { role }, user_metadata: { full_name: `حساب اختبار ${roleNames[role]}`, username: account.username } };
  const result = user ? await admin.auth.admin.updateUserById(user.id, payload) : await admin.auth.admin.createUser(payload);
  if (result.error) throw result.error;
  account.authId = result.data.user.id;
  const profile = { auth_id: account.authId, full_name: `حساب اختبار ${roleNames[role]}`, username: account.username,
    email, role, department: 'cybersecurity', academic_year: role === 'student' ? '1' : null,
    section_number: role === 'student' ? 1 : null, subject_id: ['doctor', 'ta'].includes(role) ? subject.id : null };
  const { data: old } = await admin.from('users').select('id').eq('auth_id', account.authId).maybeSingle();
  const saved = old ? await admin.from('users').update(profile).eq('id', old.id).select('id').single()
    : await admin.from('users').insert(profile).select('id').single();
  if (saved.error) throw saved.error;
  account.profileId = saved.data.id;
  accounts = [...accounts.filter(a => a.role !== role), account];
  await writeFile('.private/test-accounts.json', JSON.stringify(accounts, null, 2));
  console.log(`${role}: account ready`);
}
