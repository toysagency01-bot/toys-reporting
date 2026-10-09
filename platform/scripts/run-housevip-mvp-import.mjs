import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImportSql } from './build-housevip-mvp-import.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const wrangler = resolve(root, `node_modules/.bin/wrangler${process.platform === 'win32' ? '.cmd' : ''}`);
const common = ['d1', 'execute', 'TOYS_DB', '--config', 'wrangler.mvp.jsonc', '--local', '--persist-to', '.wrangler/mvp-state', '--json'];

function runWrangler(args) {
  const result = spawnSync(wrangler, args, { cwd: root, env: process.env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'wrangler failed').trim());
  return result.stdout;
}

function query(sql) {
  const parsed = JSON.parse(runWrangler([...common, '--command', sql]));
  if (!parsed?.[0]?.success) throw new Error('local D1 query failed');
  return parsed[0].results || [];
}

async function main() {
  const snapshotPath = resolve(process.env.HOUSEVIP_SNAPSHOT_PATH || '');
  if (!process.env.HOUSEVIP_SNAPSHOT_PATH) throw new Error('HOUSEVIP_SNAPSHOT_PATH is required');
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const preview = buildImportSql(snapshot);
  const releaseId = preview.summary.releaseId;
  const before = query(
    `SELECT p.pointer_revision AS pointerRevision, p.release_id AS releaseId, ` +
    `EXISTS(SELECT 1 FROM project_data_releases r WHERE r.id='${releaseId}') AS releaseExists ` +
    `FROM project_data_release_pointers p WHERE p.organization_id='org_toys_agency' AND p.project_id='prj_housevip_cxp7'`,
  )[0] || { pointerRevision: 0, releaseId: null, releaseExists: 0 };
  if (Number(before.releaseExists) === 1) {
    if (before.releaseId !== releaseId) {
      throw new Error(`release already imported but is not current: requested ${releaseId}, current ${before.releaseId || 'none'}`);
    }
    console.log(JSON.stringify({ ok: true, status: 'already_current', releaseId, pointerRevision: Number(before.pointerRevision || 0) }));
    return;
  }
  const expectedPointerRevision = Number(before.pointerRevision || 0);
  const built = buildImportSql(snapshot, { expectedPointerRevision });
  const out = resolve(root, '.wrangler/tmp/housevip-mvp-import.sql');
  await mkdir(dirname(out), { recursive: true, mode: 0o700 });
  await writeFile(out, built.sql, { encoding: 'utf8', mode: 0o600 });
  runWrangler([...common, '--file', out]);
  const after = query(
    `SELECT pointer_revision AS pointerRevision, release_id AS releaseId FROM project_data_release_pointers ` +
    `WHERE organization_id='org_toys_agency' AND project_id='prj_housevip_cxp7'`,
  )[0];
  if (!after || after.releaseId !== releaseId) {
    throw new Error(`release publication CAS failed: expected ${releaseId}, current ${after?.releaseId || 'none'}`);
  }
  console.log(JSON.stringify({ ok: true, status: 'published', ...built.summary, pointerRevision: Number(after.pointerRevision) }));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
