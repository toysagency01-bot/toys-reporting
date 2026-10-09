import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ID = 'prj_housevip_cxp7';
const ORGANIZATION_ID = 'org_toys_agency';
const SOURCE_STREAM_ID = 'src_housevip_metaads_snapshot';

const sha256 = value => createHash('sha256').update(String(value)).digest('hex');
const sql = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;

function datePlusOne(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function exactNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field}: expected a finite number`);
  return String(value);
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field}: expected a non-negative integer`);
  return String(value);
}

function decimalScale(value) {
  const text = String(value);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

export function validateSnapshot(snapshot) {
  if (snapshot?.schema_version !== 'housevip-pilot-snapshot/1.0') throw new Error('unsupported snapshot schema');
  if (snapshot?.project !== 'HOUSEVIP') throw new Error('snapshot project mismatch');
  if (snapshot?.privacy?.includes_personal_lead_or_contact_rows !== false) throw new Error('snapshot contains or does not classify lead PII');
  if (snapshot?.privacy?.includes_secrets !== false) throw new Error('snapshot contains or does not classify secrets');
  if (!Array.isArray(snapshot.ad_rows) || snapshot.ad_rows.length === 0) throw new Error('snapshot has no advertising rows; active release was not changed');
  if (snapshot.coverage?.missing_days_are_not_zero !== true) throw new Error('snapshot must distinguish missing dates from zero');
  if (snapshot.requested_window?.timezone !== 'Asia/Tbilisi') throw new Error('unexpected source timezone');

  const seen = new Set();
  const totals = { impressions: 0, clicks: 0, cost: 0, conversions: 0, conv_value: 0 };
  for (const [index, row] of snapshot.ad_rows.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) throw new Error(`ad_rows[${index}].date: invalid date`);
    if (row.platform !== 'Meta Ads' || row.source_tab !== 'MetaAds') throw new Error(`ad_rows[${index}]: unexpected source`);
    if (row.currency !== 'IDR') throw new Error(`ad_rows[${index}]: unexpected currency`);
    if (!String(row.campaign || '').trim()) throw new Error(`ad_rows[${index}]: campaign label missing`);
    const key = `${row.source_tab}:${row.source_row}`;
    if (seen.has(key)) throw new Error(`duplicate source row ${key}`);
    seen.add(key);
    totals.impressions += Number(integer(row.impressions, `${key}.impressions`));
    totals.clicks += Number(integer(row.clicks, `${key}.clicks`));
    totals.cost += Number(exactNumber(row.cost, `${key}.cost`));
    totals.conversions += Number(exactNumber(row.conversions, `${key}.conversions`));
    totals.conv_value += Number(exactNumber(row.conv_value, `${key}.conv_value`));
  }
  const control = snapshot.aggregates?.control_totals_by_currency?.find(row => row.currency === 'IDR');
  if (!control) throw new Error('IDR control total missing');
  for (const field of Object.keys(totals)) {
    if (totals[field] !== control[field]) throw new Error(`control total mismatch: ${field}`);
  }
  if (snapshot.coverage.available_rows !== snapshot.ad_rows.length) throw new Error('coverage row count mismatch');
  return { totals, control };
}

function valueStatement(observationId, metricCode, value, unit, currency = null, qualityFlags = []) {
  return `INSERT OR IGNORE INTO fact_values (` +
    `organization_id,project_id,observation_id,metric_code,metric_version,value_basis,value_text,scale,unit,currency,value_state,quality_flags_json,origin_refs_json` +
    `) VALUES (` +
    `${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(observationId)},${sql(metricCode)},'1','source_native',${sql(exactNumber(value, metricCode))},${decimalScale(value)},${sql(unit)},${sql(currency)},'observed',${sql(JSON.stringify(qualityFlags))},'[]');`;
}

export function buildImportSql(snapshot, { expectedPointerRevision = 0 } = {}) {
  validateSnapshot(snapshot);
  if (!Number.isInteger(expectedPointerRevision) || expectedPointerRevision < 0) {
    throw new Error('expected pointer revision must be a non-negative integer');
  }
  const canonical = JSON.stringify(snapshot);
  const sourceHash = sha256(canonical);
  const generationId = `gen_housevip_${sourceHash.slice(0, 24)}`;
  const releaseId = `rel_housevip_${sourceHash.slice(0, 24)}`;
  const idempotencyKey = sha256([
    SOURCE_STREAM_ID,
    sourceHash,
    snapshot.requested_window.start,
    snapshot.requested_window.end,
    'housevip-metaads/1',
  ].join('\u001f'));
  const requestedToExclusive = datePlusOne(snapshot.requested_window.end);
  const observedToExclusive = datePlusOne(snapshot.coverage.observed_max);
  const missingRanges = [
    { from: snapshot.requested_window.start, toExclusive: snapshot.coverage.observed_min, state: 'missing' },
    { from: observedToExclusive, toExclusive: requestedToExclusive, state: 'missing' },
  ].filter(range => range.from < range.toExclusive);
  const statements = [
    'PRAGMA foreign_keys = ON;',
    `INSERT INTO source_streams (` +
      `id,organization_id,project_id,channel_key,delivery_provider,business_provider,stable_source_ref,provider_account_ref,source_timezone,grain,source_schema_version,mapping_version,capabilities_json` +
      `) VALUES (` +
      `${sql(SOURCE_STREAM_ID)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},'meta','library_snapshot','meta_ads','MetaAds',NULL,${sql(snapshot.requested_window.timezone)},'campaign_daily','housevip-pilot-snapshot/1.0','housevip-metaads/1','["campaign_daily","reported_conversions"]') ` +
      `ON CONFLICT(organization_id,project_id,stable_source_ref) DO UPDATE SET source_timezone=excluded.source_timezone,source_schema_version=excluded.source_schema_version,mapping_version=excluded.mapping_version;`,
    `INSERT OR IGNORE INTO data_generations (` +
      `id,organization_id,project_id,source_stream_id,idempotency_key,source_hash,status,availability,coverage,freshness,requested_from,requested_to_exclusive,observed_from,observed_to_exclusive,row_count,missing_ranges_json,generated_at,sealed_at,details_json` +
      `) VALUES (` +
      `${sql(generationId)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(SOURCE_STREAM_ID)},${sql(idempotencyKey)},${sql(sourceHash)},'sealed','ok','partial','fresh',${sql(snapshot.requested_window.start)},${sql(requestedToExclusive)},${sql(snapshot.coverage.observed_min)},${sql(observedToExclusive)},${snapshot.ad_rows.length},${sql(JSON.stringify(missingRanges))},${sql(snapshot.generated_at)},${sql(snapshot.generated_at)},${sql(JSON.stringify({ currentDayMayBePartial: true, accountMapping: 'unknown', sourceMutations: false }))});`,
  ];

  for (const row of snapshot.ad_rows) {
    const legacyGroupRef = `legacy_group_${sha256(`${SOURCE_STREAM_ID}\u001f${row.campaign}`).slice(0, 24)}`;
    const observationKey = `${row.source_tab}:${row.source_row}`;
    const observationId = `obs_${sha256(`${generationId}\u001f${observationKey}`).slice(0, 28)}`;
    const rowHash = sha256(JSON.stringify(row));
    statements.push(
      `INSERT OR IGNORE INTO fact_observations (` +
        `id,organization_id,project_id,generation_id,source_stream_id,observation_key,local_date,source_timezone,reporting_date_basis,grain,account_ref,provider_campaign_id,legacy_group_ref,legacy_campaign_label,source_record_ref,source_hash` +
        `) VALUES (` +
        `${sql(observationId)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(generationId)},${sql(SOURCE_STREAM_ID)},${sql(observationKey)},${sql(row.date)},${sql(snapshot.requested_window.timezone)},'source_local_date','campaign_daily',NULL,NULL,${sql(legacyGroupRef)},${sql(row.campaign)},${sql(observationKey)},${sql(rowHash)});`,
      valueStatement(observationId, 'ads.impressions', row.impressions, 'count'),
      valueStatement(observationId, 'ads.clicks', row.clicks, 'count'),
      valueStatement(observationId, 'ads.spend', row.cost, 'money', row.currency),
      valueStatement(observationId, 'ads.reported_conversions', row.conversions, 'weighted_count'),
      valueStatement(observationId, 'legacy.conversion_value_unknown', row.conv_value, 'unknown', row.currency, ['unclassified_semantics']),
    );
  }

  const manifest = {
    datasets: [{ sourceStreamId: SOURCE_STREAM_ID, generationId, coverage: 'partial' }],
    sourceHash,
    requestedRange: { from: snapshot.requested_window.start, toExclusive: requestedToExclusive },
  };
  statements.push(
    `INSERT OR IGNORE INTO project_data_releases (` +
      `id,organization_id,project_id,revision,status,manifest_json,source_hash,created_at` +
      `) SELECT ` +
      `${sql(releaseId)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},COALESCE(MAX(revision),0)+1,'sealed',${sql(JSON.stringify(manifest))},${sql(sourceHash)},${sql(snapshot.generated_at)} ` +
      `FROM project_data_releases WHERE organization_id=${sql(ORGANIZATION_ID)} AND project_id=${sql(PROJECT_ID)};`,
    `INSERT INTO project_data_release_pointers (` +
      `organization_id,project_id,release_id,pointer_revision,updated_at` +
      `) SELECT ${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(releaseId)},1,${sql(snapshot.generated_at)} ` +
      `WHERE changes()=1 AND (` +
      `(${expectedPointerRevision}=0 AND NOT EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=${sql(ORGANIZATION_ID)} AND project_id=${sql(PROJECT_ID)})) OR ` +
      `EXISTS (SELECT 1 FROM project_data_release_pointers WHERE organization_id=${sql(ORGANIZATION_ID)} AND project_id=${sql(PROJECT_ID)} AND pointer_revision=${expectedPointerRevision})` +
      `) ` +
      `ON CONFLICT(organization_id,project_id) DO UPDATE SET ` +
      `release_id=excluded.release_id,` +
      `pointer_revision=project_data_release_pointers.pointer_revision + CASE WHEN project_data_release_pointers.release_id<>excluded.release_id THEN 1 ELSE 0 END,` +
      `updated_at=CASE WHEN project_data_release_pointers.release_id<>excluded.release_id THEN excluded.updated_at ELSE project_data_release_pointers.updated_at END ` +
      `WHERE project_data_release_pointers.pointer_revision=${expectedPointerRevision};`,
    `INSERT OR IGNORE INTO content_items (` +
      `id,organization_id,project_id,channel_key,locale,kind,logical_key,title,period_kind,lifecycle,latest_revision_number,published_revision_id` +
      `) VALUES ('content_housevip_weekly_main',${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},'meta','ru','period_summary','weekly-main','Еженедельная сводка (Meta)','week','active',1,'content_housevip_weekly_rev_1');`,
    `INSERT OR IGNORE INTO content_revisions (` +
      `id,organization_id,project_id,content_item_id,revision_number,parent_revision_id,block_schema_version,status,author_ref,reason,source_refs_json,data_snapshot_manifest_json` +
      `) VALUES ('content_housevip_weekly_rev_1',${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},'content_housevip_weekly_main',1,NULL,'1','published','snapshot-importer','Initial safe local MVP revision',${sql(JSON.stringify([{ kind: 'library_snapshot', contentIncluded: false }]))},${sql(JSON.stringify(manifest))});`,
    `INSERT OR IGNORE INTO content_blocks (` +
      `id,organization_id,project_id,revision_id,block_key,position,block_type,payload_schema_version,payload_json` +
      `) VALUES ('block_housevip_weekly_rev_1_summary',${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},'content_housevip_weekly_rev_1','summary',0,'period_summary','1',${sql(JSON.stringify({
        summary: 'Безопасная копия содержит структуру раздела, но не исходный текст сводки. Это локальная тестовая редакция.',
        wins: '', issues: 'Покрытие рекламы частичное; точные даты берутся из приватного snapshot.', changes: '', nextSteps: 'Заполните редакцию и опубликуйте её после проверки.',
      }))});`,
  );

  return { sql: `${statements.join('\n')}\n`, summary: { sourceHash, generationId, releaseId, expectedPointerRevision, observations: snapshot.ad_rows.length, facts: snapshot.ad_rows.length * 5, coverage: 'partial' } };
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const snapshotPath = resolve(arg('--snapshot', process.env.HOUSEVIP_SNAPSHOT_PATH || ''));
  if (!process.env.HOUSEVIP_SNAPSHOT_PATH && !process.argv.includes('--snapshot')) throw new Error('pass --snapshot PATH or HOUSEVIP_SNAPSHOT_PATH');
  const outPath = resolve(arg('--out', resolve(here, '../.wrangler/tmp/housevip-mvp-import.sql')));
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  const expectedPointerRevision = Number(arg('--expected-pointer-revision', process.env.HOUSEVIP_EXPECTED_POINTER_REVISION || '0'));
  const built = buildImportSql(snapshot, { expectedPointerRevision });
  await mkdir(dirname(outPath), { recursive: true, mode: 0o700 });
  await writeFile(outPath, built.sql, { encoding: 'utf8', mode: 0o600 });
  console.log(JSON.stringify({ output: outPath, ...built.summary }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
