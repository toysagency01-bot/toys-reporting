import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ORGANIZATION_ID = 'org_toys_agency';
const CLIENT_ID = 'client_demo_commerce';
const PROJECT_ID = 'prj_demo_commerce_mvp';
const PROJECT_SLUG = 'demo-commerce-mvp';
const FROM = '2026-10-01';
const TO_EXCLUSIVE = '2026-10-08';
const GENERATED_AT = '2026-10-09T12:00:00.000Z';

const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'];
const ecomDaily = [
  [120, 8000, 320, 8.5, 42, 18, 8, 960],
  [135, 8600, 344, 9.25, 46, 21, 9, 1080],
  [128, 8200, 328, 7, 40, 17, 7, 840],
  [142, 9100, 373, 11.5, 54, 25, 11, 1320],
  [150, 9600, 403, 12, 58, 27, 12, 1440],
  [155, 9900, 426, 13.25, 63, 30, 13, 1560],
  [160, 10400, 458, 14, 68, 33, 14, 1680],
];
const instashopDaily = [
  [5100, 125, 10800, 390, 18, 14, 4, 3, 12600],
  [5480, 134, 11400, 418, 20, 15, 5, 4, 17200],
  [5320, 130, 11100, 402, 19, 14, 5, 3, 13500],
  [5760, 141, 12100, 445, 23, 18, 5, 5, 22400],
  [6020, 147, 12800, 472, 25, 19, 6, 5, 23100],
  [6280, 153, 13400, 498, 27, 21, 6, 6, 27900],
  [6540, 160, 14100, 526, 29, 22, 7, 6, 28800],
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sql(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function metric(code, value, unit, currency = null) {
  return { code, value: String(value), unit, currency };
}

function ecomAccountRows() {
  return days.map((date, index) => {
    const [spend, impressions, clicks, conversions, addToCart, checkout, purchases, purchaseValue] = ecomDaily[index];
    return {
      key: date, date, accountRef: 'demo-ecom-account',
      metrics: [
        metric('ads.spend', spend, 'money', 'USD'), metric('ads.impressions', impressions, 'count'),
        metric('ads.clicks', clicks, 'count'), metric('ads.reported_conversions', conversions, 'weighted_count'),
        metric('ecom.add_to_cart', addToCart, 'count'), metric('ecom.checkout', checkout, 'count'),
        metric('ecom.purchases', purchases, 'count'), metric('ecom.purchase_value', purchaseValue, 'money', 'USD'),
      ],
    };
  });
}

function ecomCampaignRows() {
  return days.flatMap((date, index) => {
    const [spend, impressions, clicks, conversions, addToCart, checkout, purchases, purchaseValue] = ecomDaily[index];
    const first = [Math.round(spend * 0.6), Math.round(impressions * 0.6), Math.round(clicks * 0.6), Number((conversions * 0.6).toFixed(2)), Math.round(addToCart * 0.6), Math.round(checkout * 0.6), Math.round(purchases * 0.6), Math.round(purchaseValue * 0.6)];
    const second = [spend - first[0], impressions - first[1], clicks - first[2], Number((conversions - first[3]).toFixed(2)), addToCart - first[4], checkout - first[5], purchases - first[6], purchaseValue - first[7]];
    return [
      ['demo-ecom-campaign-a', 'Demo · Prospecting', first],
      ['demo-ecom-campaign-b', 'Demo · Retargeting', second],
    ].map(([campaignId, label, values]) => ({
      key: `${date}:${campaignId}`, date, accountRef: 'demo-ecom-account', campaignId, label,
      metrics: [
        metric('ads.spend', values[0], 'money', 'USD'), metric('ads.impressions', values[1], 'count'),
        metric('ads.clicks', values[2], 'count'), metric('ads.reported_conversions', values[3], 'weighted_count'),
        metric('ecom.add_to_cart', values[4], 'count'), metric('ecom.checkout', values[5], 'count'),
        metric('ecom.purchases', values[6], 'count'), metric('ecom.purchase_value', values[7], 'money', 'USD'),
      ],
    }));
  });
}

function instashopAdRows() {
  return days.flatMap((date, index) => {
    const [spendUah, rawSpendUsd, impressions, clicks, metaDirect] = instashopDaily[index];
    const first = [Math.round(spendUah * 0.58), Number((rawSpendUsd * 0.58).toFixed(2)), Math.round(impressions * 0.58), Math.round(clicks * 0.58), Number((metaDirect * 0.58).toFixed(2))];
    const second = [spendUah - first[0], Number((rawSpendUsd - first[1]).toFixed(2)), impressions - first[2], clicks - first[3], Number((metaDirect - first[4]).toFixed(2))];
    return [
      ['demo-instashop-campaign-a', 'Demo · Catalog', first],
      ['demo-instashop-campaign-b', 'Demo · Stories', second],
    ].map(([campaignId, label, values]) => ({
      key: `${date}:${campaignId}`, date, accountRef: 'demo-instashop-account', campaignId, label,
      metrics: [
        metric('ads.spend_uah', values[0], 'money', 'UAH'), metric('ads.raw_spend_usd', values[1], 'money', 'USD'),
        metric('ads.impressions', values[2], 'count'), metric('ads.clicks', values[3], 'count'),
        metric('instashop.meta_direct', values[4], 'weighted_count'),
      ],
    }));
  });
}

function instashopSalesRows() {
  return days.map((date, index) => {
    const [, , , , , qualified, unqualified, sales, revenue] = instashopDaily[index];
    return {
      key: date, date,
      metrics: [
        metric('instashop.direct_inquiries', qualified + unqualified, 'count'),
        metric('instashop.qualified_inquiries', qualified, 'count'),
        metric('instashop.unqualified_inquiries', unqualified, 'count'),
        metric('instashop.sales_count', sales, 'count'), metric('instashop.revenue_uah', revenue, 'money', 'UAH'),
      ],
    };
  });
}

const datasets = [
  { key: 'ecommerce_account', channel: 'ecommerce', provider: 'synthetic_ecommerce', grain: 'account_daily', rows: ecomAccountRows() },
  { key: 'ecommerce_campaign', channel: 'ecommerce', provider: 'synthetic_ecommerce', grain: 'campaign_daily', rows: ecomCampaignRows() },
  { key: 'instashop_ads', channel: 'instashop', provider: 'synthetic_meta_ads', grain: 'campaign_daily', rows: instashopAdRows() },
  { key: 'instashop_sales', channel: 'instashop', provider: 'synthetic_instashop', grain: 'project_daily', rows: instashopSalesRows() },
];

function datasetSql(dataset) {
  const streamId = `src_demo_${dataset.key}`;
  const generationId = `gen_demo_${dataset.key}_v1`;
  const sourceHash = sha256(JSON.stringify(dataset));
  const statements = [
    `INSERT OR IGNORE INTO source_streams (id,organization_id,project_id,channel_key,delivery_provider,business_provider,stable_source_ref,provider_account_ref,source_timezone,grain,source_schema_version,mapping_version,capabilities_json) VALUES (${sql(streamId)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(dataset.channel)},'local_fixture',${sql(dataset.provider)},${sql(`demo:${dataset.key}`)},${dataset.grain === 'project_daily' ? 'NULL' : sql(`demo:${dataset.key}:account`)},'Europe/Kyiv',${sql(dataset.grain)},'synthetic-demo/1.0','demo-commerce/1','["synthetic_only"]');`,
    `INSERT OR IGNORE INTO data_generations (id,organization_id,project_id,source_stream_id,idempotency_key,source_hash,status,availability,coverage,freshness,requested_from,requested_to_exclusive,observed_from,observed_to_exclusive,row_count,missing_ranges_json,generated_at,sealed_at,details_json) VALUES (${sql(generationId)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(streamId)},${sql(`demo:${dataset.key}:v1`)},${sql(sourceHash)},'sealed','ok','complete','fresh',${sql(FROM)},${sql(TO_EXCLUSIVE)},${sql(FROM)},${sql(TO_EXCLUSIVE)},${dataset.rows.length},'[]',${sql(GENERATED_AT)},${sql(GENERATED_AT)},'{"synthetic":true,"containsRealClientData":false}');`,
  ];
  for (const row of dataset.rows) {
    const observationId = `obs_demo_${sha256(`${dataset.key}:${row.key}`).slice(0, 28)}`;
    statements.push(
      `INSERT OR IGNORE INTO fact_observations (id,organization_id,project_id,generation_id,source_stream_id,observation_key,local_date,source_timezone,reporting_date_basis,grain,account_ref,provider_campaign_id,legacy_group_ref,legacy_campaign_label,source_record_ref,source_hash) VALUES (${sql(observationId)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(generationId)},${sql(streamId)},${sql(row.key)},${sql(row.date)},'Europe/Kyiv','source_local_date',${sql(dataset.grain)},${sql(row.accountRef)},${sql(row.campaignId)},NULL,${sql(row.label)},${sql(`synthetic:${dataset.key}:${row.key}`)},${sql(sha256(JSON.stringify(row)))});`,
    );
    for (const value of row.metrics) {
      const scale = value.value.includes('.') ? value.value.split('.')[1].length : 0;
      statements.push(
        `INSERT OR IGNORE INTO fact_values (organization_id,project_id,observation_id,metric_code,metric_version,value_basis,value_text,scale,unit,currency,value_state,quality_flags_json,origin_refs_json) VALUES (${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(observationId)},${sql(value.code)},'1','synthetic_demo',${sql(value.value)},${scale},${sql(value.unit)},${sql(value.currency)},'observed','["synthetic_demo"]','[]');`,
      );
    }
  }
  return { statements, manifest: { key: dataset.key, sourceStreamId: streamId, generationId, grain: dataset.grain, coverage: 'complete', synthetic: true } };
}

export function buildDemoCommerceSql() {
  const statements = [
    'PRAGMA foreign_keys = ON;',
    `INSERT OR IGNORE INTO clients (id,organization_id,slug,name) VALUES (${sql(CLIENT_ID)},${sql(ORGANIZATION_ID)},'demo-commerce','DEMO Commerce');`,
    `INSERT OR IGNORE INTO projects (id,organization_id,slug,name,project_type,currency,timezone,status,settings_json,client_id,capabilities_json,active_preset,default_locale) VALUES (${sql(PROJECT_ID)},${sql(ORGANIZATION_ID)},${sql(PROJECT_SLUG)},'DEMO Commerce · synthetic','agency','UAH','Europe/Kyiv','active','{"synthetic":true,"containsRealClientData":false}',${sql(CLIENT_ID)},'["ads","ecommerce","instashop","synthetic_demo"]','ecommerce','ru');`,
    `INSERT OR IGNORE INTO project_channels (organization_id,project_id,channel_key,label) VALUES (${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},'ecommerce','E-commerce'),(${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},'instashop','Instashop');`,
    `INSERT OR IGNORE INTO dashboard_config_revisions (id,organization_id,project_id,revision_number,schema_version,preset,config_json,status) VALUES ('cfg_demo_commerce_1',${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},1,'toys-dashboard-config/1.0','ecommerce','{"synthetic":true,"screens":["ecommerce","instashop"],"currencyPolicy":"native_separate"}','published');`,
    `INSERT OR IGNORE INTO dashboard_config_pointers (organization_id,project_id,revision_id) VALUES (${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},'cfg_demo_commerce_1');`,
  ];
  const manifestDatasets = [];
  for (const dataset of datasets) {
    const built = datasetSql(dataset);
    statements.push(...built.statements);
    manifestDatasets.push(built.manifest);
  }
  const manifest = { synthetic: true, containsRealClientData: false, datasets: manifestDatasets, requestedRange: { from: FROM, toExclusive: TO_EXCLUSIVE } };
  const sourceHash = sha256(JSON.stringify(manifest));
  const releaseId = `rel_demo_commerce_${sourceHash.slice(0, 20)}`;
  statements.push(
    `INSERT OR IGNORE INTO project_data_releases (id,organization_id,project_id,revision,status,manifest_json,source_hash,created_at) SELECT ${sql(releaseId)},${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},COALESCE(MAX(revision),0)+1,'sealed',${sql(JSON.stringify(manifest))},${sql(sourceHash)},${sql(GENERATED_AT)} FROM project_data_releases WHERE organization_id=${sql(ORGANIZATION_ID)} AND project_id=${sql(PROJECT_ID)};`,
    `INSERT INTO project_data_release_pointers (organization_id,project_id,release_id,pointer_revision,updated_at) SELECT ${sql(ORGANIZATION_ID)},${sql(PROJECT_ID)},${sql(releaseId)},1,${sql(GENERATED_AT)} WHERE changes()=1 ON CONFLICT(organization_id,project_id) DO UPDATE SET release_id=excluded.release_id,pointer_revision=project_data_release_pointers.pointer_revision+1,updated_at=excluded.updated_at;`,
  );
  return { sql: `${statements.join('\n')}\n`, summary: { project: PROJECT_SLUG, releaseId, datasets: datasets.length, observations: datasets.reduce((sum, item) => sum + item.rows.length, 0), synthetic: true } };
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, '../.wrangler/tmp/demo-commerce-mvp-import.sql');
  const built = buildDemoCommerceSql();
  await mkdir(dirname(out), { recursive: true, mode: 0o700 });
  await writeFile(out, built.sql, { encoding: 'utf8', mode: 0o600 });
  console.log(JSON.stringify({ output: out, ...built.summary }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
