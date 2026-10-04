import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";

process.on("uncaughtException", () => {
  console.error(
    "Backup verification failed. No production data was changed. Inspect access and archive settings locally.",
  );
  process.exit(1);
});

// This tool never writes to the production database. Verification restores to an isolated PostgreSQL runtime.
const [command = "create", filename] = process.argv.slice(2);
const password = process.env.BACKUP_PASSWORD;
if (!password || password.length < 16)
  throw new Error(
    "Set BACKUP_PASSWORD to a password of at least 16 characters; keep it outside the repository.",
  );
const directory = path.resolve(".private/backups");
await fs.mkdir(directory, { recursive: true });
const output = path.resolve(
  filename ?? path.join(directory, `academic-${new Date().toISOString().replaceAll(":", "-")}.enc`),
);
if (!output.startsWith(directory + path.sep))
  throw new Error("Backup files must stay inside .private/backups.");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const tableNames = [
  "public.users",
  "public.subjects",
  "public.user_subjects",
  "public.lectures",
  "public.sessions",
  "public.attendance",
  "public.session_roster",
  "public.academic_schedule_entries",
  "public.academic_schedule_settings",
  "public.exam_schedules",
  "public.system_logs",
  "public.join_requests",
  "public.error_reports",
  "private.academic_terms",
  "private.schedule_versions",
  "private.term_schedule_archives",
  "private.academic_cycle_controls",
  "private.academic_day_cycles",
];
const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
async function verify(archive) {
  const db = new PGlite();
  try {
    await db.exec("CREATE SCHEMA private; SET TIME ZONE 'UTC';");
    for (const ddl of archive.enums) await db.exec(ddl);
    for (const table of archive.tables) {
      await db.exec(table.ddl);
      await db.query(
        `INSERT INTO ${table.qualified} SELECT * FROM jsonb_populate_recordset(NULL::${table.qualified},$1::jsonb)`,
        [JSON.stringify(table.rows)],
      );
      const restored = (await db.query(`SELECT to_jsonb(t) row FROM ${table.qualified} t`)).rows
        .map((item) => canonical(item.row))
        .sort();
      const original = table.rows.map(canonical).sort();
      if (canonical(restored) !== canonical(original))
        throw new Error(`Restore verification failed for ${table.qualified}`);
    }
    for (const constraint of archive.constraints) await db.exec(constraint);
    for (const file of archive.files)
      if (hash(Buffer.from(file.bytes, "base64")) !== file.sha256)
        throw new Error("Storage file checksum mismatch");
    return {
      tables: archive.tables.length,
      rows: archive.tables.reduce((sum, table) => sum + table.rows.length, 0),
      files: archive.files.length,
      internalConstraints: archive.constraints.length,
    };
  } finally {
    await db.close();
  }
}
async function decrypt() {
  const envelope = JSON.parse(await fs.readFile(output, "utf8"));
  if (envelope.version !== 1) throw new Error("Unsupported archive format");
  const key = scryptSync(password, Buffer.from(envelope.salt, "base64"), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64")),
      decipher.final(),
    ]).toString(),
  );
}
if (command === "verify") {
  console.log(JSON.stringify({ verified: true, ...(await verify(await decrypt())) }));
} else if (command === "create") {
  const keys = JSON.parse(await fs.readFile(".private/api-keys.json", "utf8"));
  const secret = keys.find((item) => item.type === "secret")?.api_key;
  if (!secret) throw new Error("A local Supabase administration key is required.");
  const client = createClient("https://clfhllujvxhfvhenvwfz.supabase.co", secret, {
    auth: { persistSession: false },
  });
  const queryPath = path.join(directory, "export-query.sql");
  const list = tableNames.map((name) => `'${name}'`).join(",");
  const sql = `BEGIN; SET LOCAL TIME ZONE 'UTC';
    CREATE TEMP TABLE export_rows(qualified text,ddl text,rows jsonb) ON COMMIT DROP;
    DO $export$ DECLARE t record; ddl text; rows jsonb; BEGIN
      FOR t IN SELECT c.oid,n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname||'.'||c.relname IN (${list}) AND c.relkind='r' LOOP
        SELECT 'CREATE TABLE '||format('%I.%I',t.nspname,t.relname)||' ('||string_agg(format('%I %s%s%s',a.attname,format_type(a.atttypid,a.atttypmod),CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT '||pg_get_expr(ad.adbin,ad.adrelid) ELSE '' END),',' ORDER BY a.attnum)||')' INTO ddl
        FROM pg_attribute a LEFT JOIN pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped;
        EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM %I.%I x',t.nspname,t.relname) INTO rows;
        INSERT INTO export_rows VALUES(format('%I.%I',t.nspname,t.relname),ddl,rows);
      END LOOP;
    END $export$;
    SELECT jsonb_build_object('tables',(SELECT jsonb_agg(to_jsonb(e)) FROM export_rows e),
      'enums',(SELECT COALESCE(jsonb_agg(x.ddl),'[]') FROM (SELECT 'CREATE TYPE '||format('%I.%I',n.nspname,t.typname)||' AS ENUM ('||string_agg(quote_literal(e.enumlabel),',' ORDER BY e.enumsortorder)||')' ddl FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname IN ('public','private') GROUP BY n.nspname,t.typname) x),
      'constraints',(SELECT COALESCE(jsonb_agg('ALTER TABLE '||format('%I.%I',n.nspname,t.relname)||' ADD CONSTRAINT '||quote_ident(c.conname)||' '||pg_get_constraintdef(c.oid) ORDER BY CASE WHEN c.contype='f' THEN 1 ELSE 0 END),'[]') FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname||'.'||t.relname IN (${list}) AND c.contype IN ('p','u','c','f') AND (c.contype<>'f' OR EXISTS(SELECT 1 FROM pg_class ft JOIN pg_namespace fn ON fn.oid=ft.relnamespace WHERE ft.oid=c.confrelid AND fn.nspname||'.'||ft.relname IN (${list}))))
    ) archive; ROLLBACK;`;
  await fs.writeFile(queryPath, sql);
  const cli =
    process.env.SUPABASE_CLI_ENTRY ??
    path.join(process.env.APPDATA ?? "", "npm/node_modules/supabase/dist/supabase.js");
  const result = spawnSync(
    process.execPath,
    [cli, "db", "query", "--linked", "--file", queryPath, "--output", "json"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error("Read-only database export failed; inspect CLI access locally.");
  const archive = JSON.parse(result.stdout).rows[0].archive;
  archive.files = [];
  archive.created_at = new Date().toISOString();
  archive.scope =
    "Academic application tables and Storage objects; excludes managed Auth secrets, session tokens, function deployments and external-schema constraints.";
  const buckets = await client.storage.listBuckets();
  if (buckets.error) throw new Error("Storage inventory failed");
  async function downloadFolder(bucket, prefix = "") {
    for (let offset = 0; ; offset += 100) {
      const result = await client.storage.from(bucket).list(prefix, { limit: 100, offset });
      if (result.error) throw new Error("Storage listing failed");
      for (const object of result.data) {
        const name = prefix ? `${prefix}/${object.name}` : object.name;
        if (!object.id) {
          await downloadFolder(bucket, name);
          continue;
        }
        const response = await client.storage.from(bucket).download(name);
        if (response.error) throw new Error("Storage download failed");
        const bytes = Buffer.from(await response.data.arrayBuffer());
        archive.files.push({
          bucket,
          name,
          bytes: bytes.toString("base64"),
          sha256: hash(bytes),
          mime: response.data.type,
        });
      }
      if (result.data.length < 100) break;
    }
  }
  for (const bucket of buckets.data) await downloadFolder(bucket.id);
  const verification = await verify(archive);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(password, salt, 32), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(archive)), cipher.final()]);
  await fs.writeFile(
    output,
    JSON.stringify({
      version: 1,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: data.toString("base64"),
    }),
    { flag: "wx" },
  );
  await fs.unlink(queryPath);
  console.log(JSON.stringify({ saved: output, verified: true, ...verification }));
} else throw new Error("Use create or verify. Production restore is deliberately not automated.");
