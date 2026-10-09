const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearer(request) {
  const match = String(request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function projectSet(value) {
  return new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean));
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function authorizeMvp(request, env, projectSlug, requiredRole = 'viewer') {
  if (!['local', 'test'].includes(String(env.ENVIRONMENT || ''))) {
    return { ok: false, status: 403, error: 'mvp_auth_not_available' };
  }
  const token = bearer(request);
  if (!token) return { ok: false, status: 401, error: 'authentication_required' };
  const editorToken = String(env.MVP_EDITOR_TOKEN || '');
  const viewerToken = String(env.MVP_VIEW_TOKEN || '');
  let role = null;
  let scopes = new Set();
  if (editorToken.length >= 24 && token === editorToken) {
    role = 'editor';
    scopes = projectSet(env.MVP_EDITOR_PROJECTS);
  } else if (viewerToken.length >= 24 && token === viewerToken) {
    role = 'viewer';
    scopes = projectSet(env.MVP_VIEW_PROJECTS);
  }
  if (!role) return { ok: false, status: 401, error: 'invalid_token' };
  if (!scopes.has(projectSlug)) return { ok: false, status: 403, error: 'project_scope_forbidden' };
  if (requiredRole === 'editor' && role !== 'editor') return { ok: false, status: 403, error: 'editor_role_required' };
  return { ok: true, role, subject: `local-${role}`, projectSlug };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function decimal(value) {
  const text = String(value);
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`invalid decimal: ${text}`);
  const fraction = match[3] || '';
  const integer = BigInt(`${match[1]}${match[2]}${fraction}`);
  return { integer, scale: fraction.length };
}

function power10(value) {
  return 10n ** BigInt(value);
}

function decimalSum(values) {
  if (!values.length) return '0';
  const parsed = values.map(decimal);
  const scale = Math.max(...parsed.map(item => item.scale));
  const total = parsed.reduce((sum, item) => sum + item.integer * power10(scale - item.scale), 0n);
  const negative = total < 0n;
  const digits = (negative ? -total : total).toString().padStart(scale + 1, '0');
  const body = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return `${negative ? '-' : ''}${body}`;
}

function decimalRatio(numerator, denominator, scale = 6) {
  const a = decimal(numerator);
  const b = decimal(denominator);
  if (b.integer === 0n) return null;
  const scaled = a.integer * power10(b.scale + scale) / (b.integer * power10(a.scale));
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(scale + 1, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function metric(values, code) {
  return values.find(value => value.metricCode === code);
}

function aggregateMetric(rows, code) {
  const present = rows.map(row => metric(row.metrics, code)).filter(Boolean);
  if (!present.length) return { code, value: null, state: 'missing', reason: 'not_in_release' };
  if (present.length !== rows.length) return { code, value: null, state: 'missing', reason: 'missing_component' };
  const unavailable = present.find(item => item.state !== 'observed');
  if (unavailable) return { code, value: null, state: unavailable.state, reason: unavailable.reason || null };
  return {
    code,
    value: decimalSum(present.map(item => item.value)),
    state: 'observed',
    unit: present[0].unit,
    currency: present[0].currency || null,
    metricVersion: present[0].metricVersion,
  };
}

function effectiveFreshness(generation, asOfValue) {
  if (generation.freshness !== 'fresh' || !validDate(generation.observedToExclusive)) return generation.freshness;
  const asOf = validDate(asOfValue) ? asOfValue : new Date().toISOString().slice(0, 10);
  const observedBoundary = Date.parse(`${generation.observedToExclusive}T00:00:00Z`);
  const asOfBoundary = Date.parse(`${asOf}T00:00:00Z`);
  return asOfBoundary - observedBoundary >= 2 * 86400000 ? 'stale' : 'fresh';
}

function derivedMetric(code, numerator, denominator, multiplier = '1') {
  if (numerator.state !== 'observed' || denominator.state !== 'observed') {
    return { code, value: null, state: 'missing', reason: 'missing_component' };
  }
  if (decimal(denominator.value).integer === 0n) {
    return { code, value: null, state: 'missing', reason: 'zero_denominator' };
  }
  const multiplied = decimalSum(Array(Number(multiplier)).fill(numerator.value));
  return { code, value: decimalRatio(multiplied, denominator.value), state: 'observed', unit: 'ratio' };
}

async function projectRecord(env, slug) {
  return env.TOYS_DB.prepare(
    `SELECT p.id, p.organization_id AS organizationId, p.client_id AS clientId, p.slug, p.name,
            p.currency, p.timezone, p.default_locale AS defaultLocale, p.active_preset AS preset,
            p.capabilities_json AS capabilitiesJson, c.name AS clientName,
            cfg.id AS configRevisionId, cfg.revision_number AS configRevision, cfg.config_json AS configJson
       FROM projects p
       JOIN clients c ON c.id = p.client_id AND c.organization_id = p.organization_id
       JOIN dashboard_config_pointers cp ON cp.organization_id = p.organization_id AND cp.project_id = p.id
       JOIN dashboard_config_revisions cfg ON cfg.id = cp.revision_id
      WHERE p.slug = ? AND p.status = 'active'`,
  ).bind(slug).first();
}

async function releaseRecord(env, project) {
  return env.TOYS_DB.prepare(
    `SELECT r.id, r.revision, r.manifest_json AS manifestJson, r.source_hash AS sourceHash,
            r.created_at AS createdAt
       FROM project_data_release_pointers p
       JOIN project_data_releases r ON r.id = p.release_id
      WHERE p.organization_id = ? AND p.project_id = ?`,
  ).bind(project.organizationId, project.id).first();
}

async function generationRecord(env, project, generationId) {
  return env.TOYS_DB.prepare(
    `SELECT g.id, g.source_stream_id AS sourceStreamId, g.availability, g.coverage, g.freshness,
            g.requested_from AS requestedFrom, g.requested_to_exclusive AS requestedToExclusive,
            g.observed_from AS observedFrom, g.observed_to_exclusive AS observedToExclusive,
            g.row_count AS rowCount, g.missing_ranges_json AS missingRangesJson,
            g.generated_at AS generatedAt, g.source_hash AS sourceHash,
            s.source_timezone AS sourceTimezone
       FROM data_generations g
       JOIN source_streams s
         ON s.organization_id = g.organization_id
        AND s.project_id = g.project_id
        AND s.id = g.source_stream_id
      WHERE g.organization_id = ? AND g.project_id = ? AND g.id = ? AND g.status = 'sealed'`,
  ).bind(project.organizationId, project.id, generationId).first();
}

async function factRows(env, project, generationId) {
  const result = await env.TOYS_DB.prepare(
    `SELECT o.id, o.local_date AS localDate, o.source_timezone AS sourceTimezone,
            o.grain, o.account_ref AS accountRef, o.provider_campaign_id AS providerCampaignId,
            o.legacy_group_ref AS legacyGroupRef, o.legacy_campaign_label AS legacyCampaignLabel,
            o.source_record_ref AS sourceRecordRef, o.source_hash AS sourceHash,
            v.metric_code AS metricCode, v.metric_version AS metricVersion,
            v.value_basis AS valueBasis, v.value_text AS value, v.scale, v.unit, v.currency,
            v.value_state AS state, v.quality_flags_json AS qualityFlagsJson
       FROM fact_observations o
       JOIN fact_values v ON v.observation_id = o.id
      WHERE o.organization_id = ? AND o.project_id = ? AND o.generation_id = ?
      ORDER BY o.local_date, o.id, v.metric_code`,
  ).bind(project.organizationId, project.id, generationId).all();
  const grouped = new Map();
  for (const value of result.results || []) {
    if (!grouped.has(value.id)) {
      grouped.set(value.id, {
        observationId: value.id,
        date: value.localDate,
        sourceTimezone: value.sourceTimezone,
        grain: value.grain,
        accountRef: value.accountRef || null,
        campaign: {
          ref: value.providerCampaignId || value.legacyGroupRef || null,
          providerCampaignId: value.providerCampaignId || null,
          legacyGroupRef: value.legacyGroupRef || null,
          label: value.legacyCampaignLabel || null,
          identityKind: value.providerCampaignId ? 'provider_campaign' : 'legacy_group',
        },
        source: { recordRef: value.sourceRecordRef, hash: value.sourceHash },
        metrics: [],
      });
    }
    grouped.get(value.id).metrics.push({
      metricCode: value.metricCode,
      metricVersion: value.metricVersion,
      valueBasis: value.valueBasis,
      value: value.value,
      scale: value.scale,
      unit: value.unit,
      currency: value.currency || null,
      state: value.state,
      qualityFlags: JSON.parse(value.qualityFlagsJson || '[]'),
    });
  }
  return [...grouped.values()];
}

async function releaseDataset(env, project, descriptor, from, toExclusive) {
  if (!descriptor?.generationId) return null;
  const generation = await generationRecord(env, project, descriptor.generationId);
  if (!generation) return null;
  const rows = (await factRows(env, project, generation.id)).filter(row => row.date >= from && row.date < toExclusive);
  return {
    key: descriptor.key,
    grain: descriptor.grain || rows[0]?.grain || null,
    sourceStreamId: generation.sourceStreamId,
    generationId: generation.id,
    sourceTimezone: generation.sourceTimezone,
    coverage: generation.coverage,
    freshness: generation.freshness,
    rows,
  };
}

async function commerceDemoDashboard(env, project, release, manifest, url, auth) {
  const requested = manifest.requestedRange || {};
  const from = url.searchParams.get('from') || requested.from;
  const toExclusive = url.searchParams.get('toExclusive') || requested.toExclusive;
  if (!validDate(from) || !validDate(toExclusive) || from >= toExclusive) {
    return response({ ok: false, error: 'invalid_range' }, 400);
  }
  const descriptors = new Map((manifest.datasets || []).map(item => [item.key, item]));
  const keys = ['ecommerce_account', 'ecommerce_campaign', 'instashop_ads', 'instashop_sales'];
  const loaded = await Promise.all(keys.map(key => releaseDataset(env, project, descriptors.get(key), from, toExclusive)));
  if (loaded.some(item => !item)) return response({ ok: false, error: 'release_generation_missing' }, 500);
  const datasets = Object.fromEntries(keys.map((key, index) => [key, loaded[index]]));
  const config = JSON.parse(project.configJson || '{}');
  return response({
    ok: true,
    dashboard: {
      schemaVersion: 'toys-commerce-dashboard/1.0',
      access: { role: auth.role },
      demo: { synthetic: true, containsRealClientData: false, label: 'Синтетический demo dataset' },
      configRevision: { id: project.configRevisionId, revision: project.configRevision },
      dataReleaseRef: { id: release.id, revision: release.revision, sourceHash: release.sourceHash, createdAt: release.createdAt },
      project: {
        id: project.id, slug: project.slug, name: project.name, clientId: project.clientId,
        clientName: project.clientName, preset: project.preset,
        capabilities: JSON.parse(project.capabilitiesJson || '[]'), reportingTimezone: project.timezone,
        sourceTimezone: 'Europe/Kyiv', locale: project.defaultLocale,
      },
      range: { from, toExclusive },
      coverage: {
        availability: 'ok', status: 'complete', freshness: 'fresh', requested: { from, toExclusive },
        observed: { from, toExclusive }, missingRanges: [],
        warning: 'Только синтетические данные: экран предназначен для проверки контракта и UI.',
      },
      facts: datasets.ecommerce_campaign,
      ecommerce: {
        viewsAreAlternative: true,
        warning: 'Account daily и campaign daily — альтернативные представления, их нельзя складывать.',
        account: datasets.ecommerce_account,
        campaigns: datasets.ecommerce_campaign,
      },
      instashop: {
        ads: datasets.instashop_ads,
        sales: datasets.instashop_sales,
        campaignSales: { state: 'unsupported', reason: 'sales_are_project_daily' },
        currencyPolicy: { spendUahMetric: 'ads.spend_uah', rawSpendUsdMetric: 'ads.raw_spend_usd', additive: false },
      },
      presentation: config,
    },
  });
}

async function dashboard(request, env, slug) {
  const auth = authorizeMvp(request, env, slug, 'viewer');
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
  const url = new URL(request.url);
  const project = await projectRecord(env, slug);
  if (!project) return response({ ok: false, error: 'not_found' }, 404);
  const release = await releaseRecord(env, project);
  if (!release) return response({ ok: false, error: 'no_published_release' }, 409);
  const manifest = JSON.parse(release.manifestJson || '{}');
  if (manifest.synthetic === true && JSON.parse(project.capabilitiesJson || '[]').includes('synthetic_demo')) {
    return commerceDemoDashboard(env, project, release, manifest, url, auth);
  }
  const generationId = manifest.datasets?.[0]?.generationId;
  const generation = generationId ? await generationRecord(env, project, generationId) : null;
  if (!generation) return response({ ok: false, error: 'release_generation_missing' }, 500);

  const from = url.searchParams.get('from') || generation.observedFrom;
  const toExclusive = url.searchParams.get('toExclusive') || generation.observedToExclusive;
  if (!validDate(from) || !validDate(toExclusive) || from >= toExclusive) {
    return response({ ok: false, error: 'invalid_range' }, 400);
  }
  const channel = url.searchParams.get('channel');
  if (channel && !['all', 'meta'].includes(channel)) {
    return response({ ok: false, error: 'incompatible_filter', reason: 'channel_not_in_release' }, 400);
  }
  if (url.searchParams.get('accountRef')) {
    return response({ ok: false, error: 'incompatible_filter', reason: 'account_mapping_unknown' }, 400);
  }
  let rows = (await factRows(env, project, generation.id)).filter(row => row.date >= from && row.date < toExclusive);
  const campaignRef = url.searchParams.get('campaignRef');
  if (campaignRef) rows = rows.filter(row => row.campaign.ref === campaignRef);

  const impressions = aggregateMetric(rows, 'ads.impressions');
  const clicks = aggregateMetric(rows, 'ads.clicks');
  const spend = aggregateMetric(rows, 'ads.spend');
  const conversions = aggregateMetric(rows, 'ads.reported_conversions');
  const ctr = derivedMetric('ads.ctr', clicks, impressions, '100');
  const cpa = derivedMetric('ads.cpa', spend, conversions);
  const freshness = effectiveFreshness(generation, env.MVP_AS_OF_DATE);
  const coverage = {
    availability: generation.availability,
    status: generation.coverage,
    freshness,
    requested: { from: generation.requestedFrom, toExclusive: generation.requestedToExclusive },
    observed: { from: generation.observedFrom, toExclusive: generation.observedToExclusive },
    missingRanges: JSON.parse(generation.missingRangesJson || '[]'),
    rowCount: generation.rowCount,
    warning: freshness === 'stale'
      ? 'Опубликованная копия устарела относительно даты просмотра; показан последний подтверждённый release.'
      : (generation.coverage === 'partial' ? 'Источник покрывает только часть запрошенного окна; пропуски не считаются нулями.' : null),
  };
  return response({
    ok: true,
    dashboard: {
      schemaVersion: 'toys-dashboard/2.0',
      access: { role: auth.role },
      configRevision: { id: project.configRevisionId, revision: project.configRevision },
      dataReleaseRef: { id: release.id, revision: release.revision, sourceHash: release.sourceHash, createdAt: release.createdAt },
      project: {
        id: project.id, slug: project.slug, name: project.name, clientId: project.clientId,
        clientName: project.clientName, preset: project.preset, capabilities: JSON.parse(project.capabilitiesJson || '[]'),
        reportingTimezone: project.timezone, sourceTimezone: generation.sourceTimezone || rows[0]?.sourceTimezone || null,
        locale: project.defaultLocale,
      },
      range: { from, toExclusive },
      coverage,
      panels: [spend, impressions, clicks, ctr, conversions, cpa].map(panel => ({ ...panel, origin: { releaseId: release.id, generationId: generation.id }, coverage: generation.coverage, freshness })),
      facts: { grain: 'campaign_daily', rows },
    },
  });
}

async function contentItem(env, project, logicalKey) {
  return env.TOYS_DB.prepare(
    `SELECT id, organization_id AS organizationId, project_id AS projectId, channel_key AS channelKey,
            locale, kind, logical_key AS logicalKey, title, period_kind AS periodKind,
            period_start AS periodStart, period_end AS periodEnd,
            latest_revision_number AS latestRevision, published_revision_id AS publishedRevisionId
       FROM content_items
      WHERE organization_id = ? AND project_id = ? AND logical_key = ? AND lifecycle = 'active'`,
  ).bind(project.organizationId, project.id, logicalKey).first();
}

async function revisionModel(env, item, revisionId) {
  if (!revisionId) return null;
  const revision = await env.TOYS_DB.prepare(
    `SELECT id, revision_number AS revisionNumber, parent_revision_id AS parentRevisionId,
            status, author_ref AS authorRef, reason, created_at AS createdAt,
            data_snapshot_manifest_json AS dataSnapshotManifestJson
       FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND id = ?`,
  ).bind(item.organizationId, item.projectId, item.id, revisionId).first();
  if (!revision) return null;
  const blocks = await env.TOYS_DB.prepare(
    `SELECT id, block_key AS blockKey, position, block_type AS type,
            payload_schema_version AS payloadSchemaVersion, payload_json AS payloadJson
       FROM content_blocks
      WHERE organization_id = ? AND project_id = ? AND revision_id = ?
      ORDER BY position, block_key`,
  ).bind(item.organizationId, item.projectId, revision.id).all();
  return {
    ...revision,
    dataSnapshotManifest: revision.dataSnapshotManifestJson ? JSON.parse(revision.dataSnapshotManifestJson) : null,
    blocks: (blocks.results || []).map(block => ({ ...block, payload: JSON.parse(block.payloadJson), payloadJson: undefined })),
  };
}

async function publishedContent(request, env, slug) {
  const auth = authorizeMvp(request, env, slug, 'viewer');
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug);
  if (!project) return response({ ok: false, error: 'not_found' }, 404);
  const logicalKey = new URL(request.url).searchParams.get('logicalKey');
  if (!logicalKey) return response({ ok: false, error: 'logical_key_required' }, 400);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response({ ok: false, error: 'not_found' }, 404);
  const revision = await revisionModel(env, item, item.publishedRevisionId);
  return response({ ok: true, schemaVersion: 'toys-content/1.0', access: { role: auth.role }, item, publishedRevision: revision });
}

async function revisionHistory(request, env, slug, logicalKey) {
  const auth = authorizeMvp(request, env, slug, 'editor');
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug);
  if (!project) return response({ ok: false, error: 'not_found' }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response({ ok: false, error: 'not_found' }, 404);
  const result = await env.TOYS_DB.prepare(
    `SELECT id, revision_number AS revisionNumber, parent_revision_id AS parentRevisionId,
            status, author_ref AS authorRef, reason, created_at AS createdAt
       FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ?
      ORDER BY revision_number DESC`,
  ).bind(project.organizationId, project.id, item.id).all();
  return response({ ok: true, item: { logicalKey: item.logicalKey, publishedRevisionId: item.publishedRevisionId, latestRevision: item.latestRevision }, revisions: result.results || [] });
}

function validateBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > 8) throw new Error('blocks_required');
  const allowed = new Set(['rich_text', 'task_list', 'period_summary', 'typed_table', 'metric_snapshot']);
  return blocks.map((block, index) => {
    const type = String(block?.type || '');
    const blockKey = String(block?.blockKey || `block-${index + 1}`).trim();
    if (!allowed.has(type) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(blockKey)) throw new Error('invalid_block');
    const payload = block?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_block_payload');
    const encoded = JSON.stringify(payload);
    if (encoded.length > 25000) throw new Error('block_too_large');
    return { type, blockKey, position: index, payload };
  });
}

async function parseBody(request) {
  try { return await request.json(); } catch (_) { return null; }
}

async function storedIdempotency(env, project, action, key, requestHash) {
  if (!key) return null;
  const row = await env.TOYS_DB.prepare(
    `SELECT request_hash AS requestHash, response_json AS responseJson FROM api_idempotency_keys
      WHERE organization_id = ? AND project_id = ? AND action = ? AND idempotency_key = ?`,
  ).bind(project.organizationId, project.id, action, key).first();
  if (!row) return null;
  return row.requestHash === requestHash
    ? { response: JSON.parse(row.responseJson), conflict: false }
    : { response: null, conflict: true };
}

async function createRevision(request, env, slug, logicalKey) {
  const auth = authorizeMvp(request, env, slug, 'editor');
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug);
  if (!project) return response({ ok: false, error: 'not_found' }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response({ ok: false, error: 'not_found' }, 404);
  const body = await parseBody(request);
  if (!body) return response({ ok: false, error: 'invalid_json' }, 400);
  const expectedRevision = Number(body.expectedRevision);
  const idempotencyKey = String(request.headers.get('x-idempotency-key') || body.idempotencyKey || '');
  if (!Number.isInteger(expectedRevision) || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return response({ ok: false, error: 'invalid_revision_request' }, 400);
  }
  let blocks;
  try { blocks = validateBlocks(body.blocks); } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'invalid_blocks' }, 400);
  }
  const reason = String(body.reason || '').slice(0, 500);
  const requestHash = await sha256Text(JSON.stringify({ expectedRevision, reason, blocks }));
  const stored = await storedIdempotency(env, project, `content-revision:${item.id}`, idempotencyKey, requestHash);
  if (stored?.conflict) return response({ ok: false, error: 'idempotency_key_reuse' }, 409);
  if (stored) return response(stored.response);
  if (item.latestRevision !== expectedRevision) {
    return response({ ok: false, error: 'revision_conflict', expectedRevision, currentRevision: item.latestRevision }, 409);
  }
  const parent = await env.TOYS_DB.prepare(
    `SELECT id FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND revision_number = ?`,
  ).bind(project.organizationId, project.id, item.id, expectedRevision).first();
  const revisionNumber = expectedRevision + 1;
  const revisionId = crypto.randomUUID();
  const resultBody = {
    ok: true, revision: { id: revisionId, revisionNumber, parentRevisionId: parent?.id || null, status: 'draft', blocks },
  };
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE content_items SET latest_revision_number = ?, updated_at = datetime('now')
        WHERE organization_id = ? AND project_id = ? AND id = ? AND latest_revision_number = ?`,
    ).bind(revisionNumber, project.organizationId, project.id, item.id, expectedRevision),
    env.TOYS_DB.prepare(
      `INSERT INTO content_revisions
        (id,organization_id,project_id,content_item_id,revision_number,parent_revision_id,block_schema_version,status,author_ref,reason,source_refs_json)
       VALUES (?,?,?,?,?,?,?,'draft',?,?, '[]')`,
    ).bind(revisionId, project.organizationId, project.id, item.id, revisionNumber, parent?.id || null, '1', auth.subject, reason),
    ...blocks.map(block => env.TOYS_DB.prepare(
      `INSERT INTO content_blocks
        (id,organization_id,project_id,revision_id,block_key,position,block_type,payload_schema_version,payload_json)
       VALUES (?,?,?,?,?,?,?,'1',?)`,
    ).bind(crypto.randomUUID(), project.organizationId, project.id, revisionId, block.blockKey, block.position, block.type, JSON.stringify(block.payload))),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys (organization_id,project_id,action,idempotency_key,request_hash,response_json)
       VALUES (?,?,?,?,?,?)`,
    ).bind(project.organizationId, project.id, `content-revision:${item.id}`, idempotencyKey, requestHash, JSON.stringify(resultBody)),
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1) throw new Error('revision_conflict');
  } catch (error) {
    const current = await contentItem(env, project, logicalKey);
    return response({ ok: false, error: 'revision_conflict', expectedRevision, currentRevision: current?.latestRevision ?? null }, 409);
  }
  return response(resultBody, 201);
}

async function publishRevision(request, env, slug, logicalKey, revisionId) {
  const auth = authorizeMvp(request, env, slug, 'editor');
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug);
  if (!project) return response({ ok: false, error: 'not_found' }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response({ ok: false, error: 'not_found' }, 404);
  const target = await revisionModel(env, item, revisionId);
  if (!target) return response({ ok: false, error: 'revision_not_found' }, 404);
  const body = await parseBody(request);
  if (!body) return response({ ok: false, error: 'invalid_json' }, 400);
  const expectedPublishedRevisionId = body.expectedPublishedRevisionId == null ? null : String(body.expectedPublishedRevisionId);
  const idempotencyKey = String(request.headers.get('x-idempotency-key') || body.idempotencyKey || '');
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return response({ ok: false, error: 'idempotency_key_required' }, 400);
  const action = `content-publish:${item.id}`;
  const requestHash = await sha256Text(JSON.stringify({ revisionId, expectedPublishedRevisionId }));
  const stored = await storedIdempotency(env, project, action, idempotencyKey, requestHash);
  if (stored?.conflict) return response({ ok: false, error: 'idempotency_key_reuse' }, 409);
  if (stored) return response(stored.response);
  if ((item.publishedRevisionId || null) !== expectedPublishedRevisionId) {
    return response({ ok: false, error: 'publish_conflict', expectedPublishedRevisionId, currentPublishedRevisionId: item.publishedRevisionId }, 409);
  }
  const resultBody = { ok: true, publishedRevisionId: revisionId, previousPublishedRevisionId: item.publishedRevisionId };
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE content_items SET published_revision_id = ?, updated_at = datetime('now')
        WHERE organization_id = ? AND project_id = ? AND id = ?
          AND ((published_revision_id = ?) OR (published_revision_id IS NULL AND ? IS NULL))`,
    ).bind(revisionId, project.organizationId, project.id, item.id, expectedPublishedRevisionId, expectedPublishedRevisionId),
    env.TOYS_DB.prepare(
      `UPDATE content_revisions SET status = 'published'
        WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND id = ?
          AND changes() = 1`,
    ).bind(project.organizationId, project.id, item.id, revisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys (organization_id,project_id,action,idempotency_key,request_hash,response_json)
       SELECT ?,?,?,?,?,? WHERE changes() = 1`,
    ).bind(project.organizationId, project.id, action, idempotencyKey, requestHash, JSON.stringify(resultBody)),
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1 || Number(batch?.[2]?.meta?.changes || 0) !== 1) {
      throw new Error('publish_conflict');
    }
  } catch (_) {
    const current = await contentItem(env, project, logicalKey);
    return response({ ok: false, error: 'publish_conflict', currentPublishedRevisionId: current?.publishedRevisionId ?? null }, 409);
  }
  const readbackItem = await contentItem(env, project, logicalKey);
  const readback = await revisionModel(env, readbackItem, readbackItem.publishedRevisionId);
  return response({ ...resultBody, readback });
}

async function saveAndPublishRevision(request, env, slug, logicalKey) {
  const auth = authorizeMvp(request, env, slug, 'editor');
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug);
  if (!project) return response({ ok: false, error: 'not_found' }, 404);
  const item = await contentItem(env, project, logicalKey);
  if (!item) return response({ ok: false, error: 'not_found' }, 404);
  const body = await parseBody(request);
  if (!body) return response({ ok: false, error: 'invalid_json' }, 400);
  const expectedRevision = Number(body.expectedRevision);
  const expectedPublishedRevisionId = body.expectedPublishedRevisionId == null ? null : String(body.expectedPublishedRevisionId);
  const idempotencyKey = String(request.headers.get('x-idempotency-key') || body.idempotencyKey || '');
  if (!Number.isInteger(expectedRevision) || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return response({ ok: false, error: 'invalid_revision_request' }, 400);
  }
  let blocks;
  try { blocks = validateBlocks(body.blocks); } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'invalid_blocks' }, 400);
  }
  const reason = String(body.reason || '').slice(0, 500);
  const requestHash = await sha256Text(JSON.stringify({ expectedRevision, expectedPublishedRevisionId, reason, blocks }));
  const action = `content-save-publish:${item.id}`;
  const stored = await storedIdempotency(env, project, action, idempotencyKey, requestHash);
  if (stored?.conflict) return response({ ok: false, error: 'idempotency_key_reuse' }, 409);
  if (stored) return response(stored.response);
  if (item.latestRevision !== expectedRevision || (item.publishedRevisionId || null) !== expectedPublishedRevisionId) {
    return response({
      ok: false, error: 'revision_conflict', expectedRevision, currentRevision: item.latestRevision,
      expectedPublishedRevisionId, currentPublishedRevisionId: item.publishedRevisionId,
    }, 409);
  }
  const parent = await env.TOYS_DB.prepare(
    `SELECT id FROM content_revisions
      WHERE organization_id = ? AND project_id = ? AND content_item_id = ? AND revision_number = ?`,
  ).bind(project.organizationId, project.id, item.id, expectedRevision).first();
  const revisionId = crypto.randomUUID();
  const revisionNumber = expectedRevision + 1;
  const resultBody = { ok: true, revision: { id: revisionId, revisionNumber, parentRevisionId: parent?.id || null, status: 'published' } };
  const statements = [
    env.TOYS_DB.prepare(
      `UPDATE content_items
          SET latest_revision_number = ?, published_revision_id = ?, updated_at = datetime('now')
        WHERE organization_id = ? AND project_id = ? AND id = ? AND latest_revision_number = ?
          AND ((published_revision_id = ?) OR (published_revision_id IS NULL AND ? IS NULL))`,
    ).bind(revisionNumber, revisionId, project.organizationId, project.id, item.id, expectedRevision, expectedPublishedRevisionId, expectedPublishedRevisionId),
    env.TOYS_DB.prepare(
      `INSERT INTO content_revisions
        (id,organization_id,project_id,content_item_id,revision_number,parent_revision_id,block_schema_version,status,author_ref,reason,source_refs_json)
       SELECT ?,?,?,?,?,?,?,'published',?,?, '[]' WHERE changes() = 1`,
    ).bind(revisionId, project.organizationId, project.id, item.id, revisionNumber, parent?.id || null, '1', auth.subject, reason),
    ...blocks.map(block => env.TOYS_DB.prepare(
      `INSERT INTO content_blocks
        (id,organization_id,project_id,revision_id,block_key,position,block_type,payload_schema_version,payload_json)
       SELECT ?,?,?,?,?,?,?,'1',? WHERE EXISTS (
         SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?
       )`,
    ).bind(crypto.randomUUID(), project.organizationId, project.id, revisionId, block.blockKey, block.position, block.type, JSON.stringify(block.payload), project.organizationId, project.id, revisionId)),
    env.TOYS_DB.prepare(
      `INSERT INTO api_idempotency_keys (organization_id,project_id,action,idempotency_key,request_hash,response_json)
       SELECT ?,?,?,?,?,? WHERE EXISTS (
         SELECT 1 FROM content_revisions WHERE organization_id = ? AND project_id = ? AND id = ?
       )`,
    ).bind(project.organizationId, project.id, action, idempotencyKey, requestHash, JSON.stringify(resultBody), project.organizationId, project.id, revisionId),
  ];
  try {
    const batch = await env.TOYS_DB.batch(statements);
    if (Number(batch?.[0]?.meta?.changes || 0) !== 1 || Number(batch?.at(-1)?.meta?.changes || 0) !== 1) {
      throw new Error('revision_conflict');
    }
  } catch (_) {
    const current = await contentItem(env, project, logicalKey);
    return response({ ok: false, error: 'revision_conflict', currentRevision: current?.latestRevision ?? null, currentPublishedRevisionId: current?.publishedRevisionId ?? null }, 409);
  }
  const readbackItem = await contentItem(env, project, logicalKey);
  const readback = await revisionModel(env, readbackItem, readbackItem.publishedRevisionId);
  return response({ ...resultBody, readback }, 201);
}

async function exchangeRate(request, env, slug) {
  const auth = authorizeMvp(request, env, slug, 'viewer');
  if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
  const project = await projectRecord(env, slug);
  if (!project) return response({ ok: false, error: 'not_found' }, 404);
  const url = new URL(request.url);
  const base = String(url.searchParams.get('base') || '').toUpperCase();
  const quote = String(url.searchParams.get('quote') || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) return response({ ok: false, error: 'invalid_currency' }, 400);
  const rate = await env.TOYS_DB.prepare(
    `SELECT rate_date AS date, base_currency AS base, quote_currency AS quote, rate, source
       FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? ORDER BY rate_date DESC LIMIT 1`,
  ).bind(base, quote).first();
  if (!rate) return response({ ok: false, error: 'not_found' }, 404);
  return response({ ok: true, rate: { ...rate, basis: 'latest_reference' } });
}

export async function handleMvpApi(request, env) {
  const url = new URL(request.url);
  const dashboardMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/dashboard$/);
  if (request.method === 'GET' && dashboardMatch) return dashboard(request, env, dashboardMatch[1]);
  const contentMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content$/);
  if (request.method === 'GET' && contentMatch) return publishedContent(request, env, contentMatch[1]);
  const historyMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/revisions$/);
  if (request.method === 'GET' && historyMatch) return revisionHistory(request, env, historyMatch[1], historyMatch[2]);
  if (request.method === 'POST' && historyMatch) return createRevision(request, env, historyMatch[1], historyMatch[2]);
  const savePublishMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/save-and-publish$/);
  if (request.method === 'POST' && savePublishMatch) return saveAndPublishRevision(request, env, savePublishMatch[1], savePublishMatch[2]);
  const publishMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/content\/([a-z0-9-]+)\/revisions\/([a-z0-9-]+)\/publish$/);
  if (request.method === 'POST' && publishMatch) return publishRevision(request, env, publishMatch[1], publishMatch[2], publishMatch[3]);
  const rateMatch = url.pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/exchange-rate$/);
  if (request.method === 'GET' && rateMatch) return exchangeRate(request, env, rateMatch[1]);
  return response({ ok: false, error: 'not_found' }, 404);
}

export const __test = { decimal, decimalRatio, decimalSum, validDate };
