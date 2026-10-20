#!/usr/bin/env python3
"""Deterministic, wholly synthetic sales showroom. Never reads client data.

Generate SQL only. Applying it requires the existing authenticated D1 connection.
"""
import calendar
import datetime as dt
import hashlib
import json
import pathlib
import sqlite3
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
ORG = 'org_toys_agency'
PROJECT = 'prj_nova_sales_demo'
SLUG = 'nova-sales-demo'
NOW = '2026-10-20T08:00:00.000Z'
NOTICE = 'ДЕМО. Все компании, контакты, рекламные показатели и продажи вымышлены. Не является кейсом или обещанием результата.'
MONTHS = [
    ('2026-08', 31, 780000, 410, 214, 48, 6720000),
    ('2026-09', 30, 940000, 568, 329, 82, 12628000),
    ('2026-10', 19, 690000, 438, 279, 73, 12045000),
]
CAMPAIGNS = [
    ('meta', 'demo-meta-leadform', 'Meta · Консультация для бизнеса', 0.34),
    ('meta', 'demo-meta-video', 'Meta · Видео эксперта', 0.22),
    ('meta', 'demo-meta-retarget', 'Meta · Повторные обращения', 0.14),
    ('google', 'demo-google-search', 'Google · Поиск услуг', 0.22),
    ('google', 'demo-google-brand', 'Google · Брендовый спрос', 0.08),
]


def js(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def split(total, weights):
    base = [int(total * w / sum(weights)) for w in weights]
    order = sorted(range(len(weights)), key=lambda i: (total * weights[i] / sum(weights) - base[i], -i), reverse=True)
    for i in order[:total - sum(base)]:
        base[i] += 1
    assert sum(base) == total
    return base


def build():
    statements = []

    def literal(v):
        if v is None:
            return 'NULL'
        if isinstance(v, (int, float)):
            return str(v)
        return "'" + str(v).replace("'", "''") + "'"

    def insert(table, values):
        statements.append(f"INSERT OR IGNORE INTO {table} ({','.join(values)}) VALUES ({','.join(literal(v) for v in values.values())});")

    # Refuse a collision with any non-demo project before writing its children.
    statements.extend([
        'PRAGMA foreign_keys=ON;',
        'CREATE TEMP TABLE sales_demo_guard(ok INTEGER CHECK(ok=1));',
        f"INSERT INTO sales_demo_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM projects WHERE (id='{PROJECT}' OR slug='{SLUG}') AND (id!='{PROJECT}' OR slug!='{SLUG}' OR COALESCE(json_extract(settings_json,'$.synthetic'),0)!=1)) THEN 0 ELSE 1 END;",
    ])
    insert('clients', dict(id='client_nova_sales_demo', organization_id=ORG, slug=SLUG, name='NOVA Business Services · DEMO'))
    insert('projects', dict(id=PROJECT, organization_id=ORG, slug=SLUG, name='NOVA Business Services · DEMO', project_type='leadgen', currency='EUR', timezone='Asia/Tbilisi', status='active', client_id='client_nova_sales_demo', active_preset='leadgen', capabilities_json=js(['ads', 'content', 'period_reports', 'synthetic_demo']), settings_json=js(dict(synthetic=True, containsRealClientData=False, crmTemplate='toys_agency', excludeFromAgencyReview=True, notice=NOTICE))))
    for channel, label in [('all', 'Все'), ('meta', 'Meta Ads'), ('google', 'Google Ads'), ('project', 'Проект')]:
        insert('project_channels', dict(organization_id=ORG, project_id=PROJECT, channel_key=channel, label=label))
    insert('dashboard_config_revisions', dict(id='cfg_nova_demo_v1', organization_id=ORG, project_id=PROJECT, revision_number=1, schema_version='toys-dashboard-config/1.0', preset='leadgen', config_json=js(dict(synthetic=True, defaultView='metrics', currencyPolicy='native', contentNavigation=['project', 'meta', 'google'])), status='published'))
    insert('dashboard_config_pointers', dict(organization_id=ORG, project_id=PROJECT, revision_id='cfg_nova_demo_v1'))
    insert('crm_projects', dict(project_id=PROJECT, enabled_at='2026-08-01T00:00:00.000Z', timezone='Asia/Tbilisi', updated_at=NOW, capi_enabled=0, capi_kinds='', access_mode='admin'))
    facts = []
    leads = []
    summaries = []
    sequence = 0
    for month, days, spend, count, qualified, sales, revenue in MONTHS:
        weights = [100 + ((i * 17 + int(month[-2:]) * 13) % 53) for i in range(days)]
        daily_leads = split(count, weights)
        daily_qualified = split(qualified, daily_leads)
        daily_sales = split(sales, daily_qualified)
        daily_spend = split(spend, [w * (1 + (i % 4) / 20) for i, w in enumerate(weights)])
        deal_amounts = split(revenue, [85 + (i * 19 % 55) for i in range(sales)])
        sold_index = 0
        for day in range(days):
            date = f'{month}-{day+1:02d}'
            channel_counts = split(daily_leads[day], [c[3] for c in CAMPAIGNS])
            costs = split(daily_spend[day], [c[3] for c in CAMPAIGNS])
            q_left, s_left = daily_qualified[day], daily_sales[day]
            # Spread each day's qualifications and sales across all campaigns.
            q_counts = split(q_left, channel_counts)
            s_counts = split(s_left, q_counts)
            for ci, (channel, campaign, title, _) in enumerate(CAMPAIGNS):
                clicks = max(channel_counts[ci] * (13 if channel == 'meta' else 9) + (day * 7 + ci * 3) % 23, 1)
                impressions = clicks * (39 if channel == 'meta' else 18) + day * 19
                facts.append(dict(date=date, channel=channel, campaign=campaign, title=title, spendCents=costs[ci], leads=channel_counts[ci], impressions=impressions, clicks=clicks))
                for local in range(channel_counts[ci]):
                    sequence += 1
                    is_q = local < q_counts[ci]
                    is_sale = local < s_counts[ci]
                    status = 'Успешно реализовано' if is_sale else (['Квалифицирован', 'Кикоф митинг', 'Готовим КП аудит', 'Презентовали КП', 'Согласование договора'][(sequence + day) % 5] if is_q else ['Новые', 'Первичный контакт', 'Фолоу ап 1', 'Фолоу ап 2', 'Вышел на связь', 'Отложенные (перспективные)', 'Отложенные (малоперспективные)', 'Нет ответа, без номера, мусор', 'Закрыто, но не реализовано'][sequence % 9])
                    lead = dict(id=f'nova_demo_lead_{sequence:04d}', date=date, channel=channel, campaign=campaign, qualified=is_q, sold=is_sale, status=status, valueCents=deal_amounts[sold_index] if is_sale else None)
                    if is_sale:
                        sold_index += 1
                    leads.append(lead)
        summaries.append(dict(month=month, days=days, spend=spend/100, leads=count, qualified=qualified, sales=sales, revenue=revenue/100, cpl=round(spend/100/count, 2), cpql=round(spend/100/qualified, 2), cac=round(spend/100/sales, 2), roas=round(revenue/spend, 2)))
    for channel in ['meta', 'google']:
        rows = [r for r in facts if r['channel'] == channel]
        stream, generation = f'src_nova_demo_{channel}', f'gen_nova_demo_{channel}_v1'
        insert('source_streams', dict(id=stream, organization_id=ORG, project_id=PROJECT, channel_key=channel, delivery_provider='local_fixture', business_provider='synthetic_'+channel, stable_source_ref='sales-demo:'+channel, provider_account_ref='demo-only:'+channel, source_timezone='Asia/Tbilisi', grain='campaign_daily', source_schema_version='synthetic-sales-demo/1', mapping_version='1', capabilities_json='["synthetic_only"]'))
        insert('data_generations', dict(id=generation, organization_id=ORG, project_id=PROJECT, source_stream_id=stream, idempotency_key=generation, source_hash=hashlib.sha256(js(rows).encode()).hexdigest(), status='sealed', availability='ok', coverage='complete', freshness='fresh', requested_from='2026-08-01', requested_to_exclusive='2026-10-20', observed_from='2026-08-01', observed_to_exclusive='2026-10-20', row_count=len(rows), missing_ranges_json='[]', generated_at=NOW, sealed_at=NOW, details_json=js(dict(synthetic=True, notice=NOTICE))))
        for row in rows:
            oid = f"obs_nova_demo_{row['date']}_{row['campaign']}"
            insert('fact_observations', dict(id=oid, organization_id=ORG, project_id=PROJECT, generation_id=generation, source_stream_id=stream, observation_key=oid, local_date=row['date'], source_timezone='Asia/Tbilisi', reporting_date_basis='source_local_date', grain='campaign_daily', account_ref='demo-only:'+channel, provider_campaign_id=row['campaign'], legacy_campaign_label=row['title'], source_record_ref=oid, source_hash=hashlib.sha256(js(row).encode()).hexdigest()))
            for code, value, unit, currency in [('ads.spend', f"{row['spendCents']/100:.2f}", 'money', 'EUR'), ('ads.impressions', str(row['impressions']), 'count', None), ('ads.clicks', str(row['clicks']), 'count', None), ('ads.reported_conversions', str(row['leads']), 'count', None)]:
                insert('fact_values', dict(organization_id=ORG, project_id=PROJECT, observation_id=oid, metric_code=code, metric_version='1', value_basis='synthetic_demo', value_text=value, scale=2 if unit=='money' else 0, unit=unit, currency=currency, value_state='observed', quality_flags_json='["synthetic_demo"]', origin_refs_json='[]'))
            insert('ad_metrics_daily', dict(project_id=PROJECT, provider='meta_ads' if channel=='meta' else 'google_ads', external_campaign_id=row['campaign'], metric_date=row['date'], currency='EUR', impressions=row['impressions'], clicks=row['clicks'], spend=row['spendCents']/100, leads=row['leads'], conversions=row['leads']))
    manifest = dict(synthetic=True, containsRealClientData=False, leadgenChannels=True, notice=NOTICE, datasets=[dict(channelKey=c, sourceStreamId='src_nova_demo_'+c, generationId='gen_nova_demo_'+c+'_v1', grain='campaign_daily') for c in ['meta', 'google']])
    insert('project_data_releases', dict(id='rel_nova_demo_v1', organization_id=ORG, project_id=PROJECT, revision=1, status='sealed', manifest_json=js(manifest), source_hash=hashlib.sha256(js(manifest).encode()).hexdigest(), created_at=NOW))
    insert('project_data_release_pointers', dict(organization_id=ORG, project_id=PROJECT, release_id='rel_nova_demo_v1', pointer_revision=1, updated_at=NOW))
    for n, lead in enumerate(leads):
        lid, date = lead['id'], lead['date']
        created, qualified_at, sold_at = date+'T07:00:00.000Z', date+'T09:00:00.000Z', date+'T12:00:00.000Z'
        metadata = dict(synthetic=True, notice=NOTICE, description=['Регистрация и сопровождение бизнеса', 'Бухгалтерское сопровождение', 'Юридическое сопровождение'][n % 3], adAttribution=dict(version=1, provider='meta_ads' if lead['channel']=='meta' else 'google_ads', accountId='demo-only:'+lead['channel'], campaignId=lead['campaign'], adId=lead['campaign']+'-creative-'+str(n%3+1)), qualification=dict(budgetConfirmed=lead['qualified'], decisionMakerConfirmed=lead['qualified'], timeline='до 30 дней' if lead['qualified'] else 'не подтверждён'), utm=dict(source='facebook' if lead['channel']=='meta' else 'google', medium='paid_social' if lead['channel']=='meta' else 'cpc', campaign=lead['campaign'], content='demo-creative-'+str(n%3+1)))
        insert('leads', dict(id=lid, project_id=PROJECT, source_provider='synthetic_demo', external_lead_id=lid, campaign_external_id=lead['campaign'], created_at=created, name=f'Демо-клиент {n+1:04d}', email=f'lead{n+1:04d}@example.test', contact_method='Демо-контакт', budget='1500–5000 EUR · демо', current_status=lead['status'], status_updated_at=sold_at if lead['sold'] else qualified_at if lead['qualified'] else created, metadata_json=js(metadata), updated_at=NOW))
        insert('crm_lead_state', dict(lead_id=lid, version=3 if lead['sold'] else 2 if lead['qualified'] else 1, qualified_at=qualified_at if lead['qualified'] else None, sold_at=sold_at if lead['sold'] else None, sale_value=f"{lead['valueCents']/100:.2f}" if lead['sold'] else None, sale_currency='EUR' if lead['sold'] else None, owner_label=['Анна · DEMO', 'Марк · DEMO', 'София · DEMO'][n%3], updated_at=NOW))
        insert('lead_status_events', dict(id=lid+'_new', project_id=PROJECT, lead_id=lid, to_status='Новые', changed_at=created, note=js(dict(actor='synthetic-demo', note=NOTICE))))
        if lead['qualified']:
            insert('crm_milestones', dict(id=lid+'_qualified', project_id=PROJECT, lead_id=lid, kind='qualified', occurred_at=qualified_at))
            insert('lead_status_events', dict(id=lid+'_q', project_id=PROJECT, lead_id=lid, from_status='Первичный контакт', to_status='Квалифицирован', changed_at=qualified_at, note=js(dict(actor='synthetic-demo', note='Демо: подтверждены задача, бюджет, полномочия и срок.'))))
        if lead['sold']:
            amount = f"{lead['valueCents']/100:.2f}"
            insert('crm_milestones', dict(id=lid+'_sale', project_id=PROJECT, lead_id=lid, kind='sale', occurred_at=sold_at, value=amount, currency='EUR'))
            insert('sales', dict(id=lid+'_sale', project_id=PROJECT, lead_id=lid, external_sale_id=lid+'_sale', source='synthetic_demo', sale_date=date, amount=amount, currency='EUR', status='confirmed', metadata_json=js(dict(synthetic=True))))
            insert('lead_status_events', dict(id=lid+'_won', project_id=PROJECT, lead_id=lid, from_status='Согласование договора', to_status='Успешно реализовано', changed_at=sold_at, note=js(dict(actor='synthetic-demo', note='Демо: сделка закрыта, сумма отражена в выручке.', sale=dict(value=amount, currency='EUR')))))
        if n % 7 == 0 or lead['sold']:
            insert('lead_comments', dict(id=lid+'_comment', project_id=PROJECT, lead_id=lid, body=('Демо. Клиент подтвердил условия; договор и оплата отражены в карточке.' if lead['sold'] else 'Демо. Следующий шаг: уточнить задачу и назначить консультацию. Источник и кампания сохранены.'), created_at=sold_at if lead['sold'] else qualified_at))

    def totals(start, end, channel=None):
        fs = [r for r in facts if start <= r['date'] <= end and (not channel or r['channel']==channel)]
        ls = [l for l in leads if start <= l['date'] <= end and (not channel or l['channel']==channel)]
        cost = sum(r['spendCents'] for r in fs)/100
        q, won = sum(l['qualified'] for l in ls), sum(l['sold'] for l in ls)
        rev = sum(l['valueCents'] or 0 for l in ls)/100
        return dict(spend=cost, leads=len(ls), qualified=q, sales=won, revenue=rev, cpql=round(cost/q, 2) if q else None, cac=round(cost/won, 2) if won else None, roas=round(rev/cost, 2) if cost else None)

    reports = []
    for start in [dt.date(2026, 10, 1), dt.date(2026, 10, 5), dt.date(2026, 10, 12)]:
        end = min(start+dt.timedelta(days=6 if start.day != 1 else 3), dt.date(2026,10,19))
        for channel in ['meta', 'google']:
            v = totals(start.isoformat(), end.isoformat(), channel)
            reports.append((start.isoformat(), end.isoformat(), v, channel))
    for index, (start, end, v, channel) in enumerate(reports):
        key = 'weekly-main' if index == len(reports)-1 else 'weekly-'+str(uuid.uuid5(uuid.NAMESPACE_URL, SLUG+channel+start))
        iid, rid = f'content_nova_demo_{index}', f'revision_nova_demo_{index}'
        payload = dict(channel=channel, periodStart=start, periodEnd=end, summary=f"ДЕМО · Сквозной результат: {v['leads']} лидов → {v['qualified']} квалификаций → {v['sales']} продаж. Расход {v['spend']:,.2f} EUR, выручка {v['revenue']:,.2f} EUR. {NOTICE}", wins=f"Стоимость квалификации {v['cpql']} EUR. Стоимость продажи {v['cac']} EUR. Выручка / рекламные расходы: {v['roas']}×. Все суммы вычислены из демонстрационных карточек CRM и рекламных строк.", issues='В модель включены нецелевые обращения, отсутствие ответа и отложенные решения. Показатели являются вымышленным сценарием; ROAS не равен прибыли. Себестоимость, налоги и агентское вознаграждение в расчёт не входят.', changes='Разделены рекламные каналы, источники и кампании. В CRM сохранены даты квалификации, статусы, ответственные и суммы продаж. Рекламные расходы учитываются один раз.', nextSteps='В демо-сценарии: проверить качество обращений по кампаниям, доработать первый контакт, протестировать новую подачу консультации и оценивать решение по стоимости квалификации.', attachments=[])
        insert('content_items', dict(id=iid, organization_id=ORG, project_id=PROJECT, channel_key='all', locale='ru', kind='period_summary', logical_key=key, title='Итоги и комментарии · DEMO', period_kind='custom' if index==len(reports)-1 else 'week', period_start=start, period_end=end, latest_revision_number=1, published_revision_id=rid))
        insert('content_revisions', dict(id=rid, organization_id=ORG, project_id=PROJECT, content_item_id=iid, revision_number=1, status='published', author_ref='synthetic-demo', reason='Синтетическая витрина для sales-звонков', created_at=NOW))
        insert('content_blocks', dict(id=f'block_nova_demo_{index}', organization_id=ORG, project_id=PROJECT, revision_id=rid, block_key='summary', position=0, block_type='period_summary', payload_json=js(payload)))

    all_totals = totals('2026-08-01', '2026-10-19')
    tables = [
        ('project', 'overview', 'О проекте', ['Раздел', 'Описание'], [
            ['Статус', NOTICE], ['Бизнес', 'NOVA Business Services · вымышленный B2B-сервис для предпринимателей'],
            ['Направления', 'Регистрация бизнеса, бухгалтерское и юридическое сопровождение'], ['Период', '1 августа — 19 октября 2026; октябрь — неполный месяц'],
            ['Воронка', 'Обращение → первый контакт → квалификация → встреча → предложение → договор → продажа'],
            ['Квалификация', 'Подтверждены задача, бюджет, лицо принимающее решение и срок до 30 дней.'],
            ['Выручка', 'Сумма 203 закрытых демосделок в EUR. Не прогноз и не сумма открытых предложений.'],
        ]),
        ('project', 'analytics', 'Сквозная аналитика', ['Период', 'Расход EUR', 'Лиды', 'Квал', 'Продажи', 'Выручка EUR', 'CPL EUR', 'CPQL EUR', 'CAC EUR', 'ROAS'], [
            [m['month']+(' · 1–19 число' if m['month']=='2026-10' else ''), m['spend'], m['leads'], m['qualified'], m['sales'], m['revenue'], m['cpl'], m['cpql'], m['cac'], m['roas']] for m in summaries
        ]),
        ('project', 'methodology', 'Как считаются цифры', ['Показатель', 'Формула и источник'], [
            ['Обозначение', NOTICE], ['CPL', 'Расход рекламы / все обращения за выбранный период'], ['CPQL', 'Расход рекламы / первые квалификации CRM за период'],
            ['CAC по рекламе', 'Расход рекламы / первые продажи CRM за период. Остальные затраты не включены.'], ['ROAS', 'Подтверждённая демовыручка / рекламные расходы; не показатель прибыли.'],
            ['Период CRM', 'Дата первого перехода в квалификацию / продажу; Asia/Tbilisi.'], ['Независимость', 'Ни одна строка реального проекта не использована. Контакты используют example.test.'],
            ['Доставка событий', 'Внешние интеграции и CAPI отключены. Демособытия не отправляются в рекламные системы.'],
        ]),
        ('project', 'plan', 'План работ', ['Этап', 'Задача', 'Срок', 'Ответственный', 'Статус'], [
            ['Аналитика', 'Согласовать единые критерии квалификации и продажи', '01.08.2026', 'Аналитик · DEMO', 'Готово'],
            ['CRM', 'Зафиксировать источник, кампанию, ответственного и результат обращения', '03.08.2026', 'CRM-менеджер · DEMO', 'Готово'],
            ['Meta Ads', 'Разделить консультацию, экспертное видео и повторные касания', '05.08.2026', 'Медиабайер · DEMO', 'Готово'],
            ['Google Ads', 'Отдельно оценивать поисковый и брендовый спрос', '06.08.2026', 'PPC · DEMO', 'Готово'],
            ['Оптимизация', 'Сравнивать стоимость квалификации, продажи и выручку', 'Еженедельно', 'Команда · DEMO', 'В работе'],
            ['Следующий спринт', 'Новая подача консультации и контроль первого контакта', '26.10.2026', 'Команда · DEMO', 'Запланировано'],
        ]),
    ]
    for channel in ['meta', 'google']:
        channel_rows=[]
        for _, campaign, title, _ in [c for c in CAMPAIGNS if c[0]==channel]:
            fs=[r for r in facts if r['campaign']==campaign]
            ls=[l for l in leads if l['campaign']==campaign]
            spend=sum(r['spendCents'] for r in fs)/100
            q=sum(l['qualified'] for l in ls)
            sold=sum(l['sold'] for l in ls)
            revenue=sum(l['valueCents'] or 0 for l in ls)/100
            channel_rows.append([title, spend, len(ls), q, round(spend/q,2), sold, revenue, round(revenue/spend,2)])
        tables.append((channel, 'performance', 'Результаты кампаний', ['Кампания · DEMO', 'Расход EUR', 'Лиды', 'Квал', 'CPQL EUR', 'Продажи', 'Выручка EUR', 'ROAS'], channel_rows))
        tables.append((channel, 'report', 'Отчёт по направлению', ['Блок', 'Комментарий'], [
            ['Статус', NOTICE], ['Что сделано', 'Подготовлены отдельные кампании по намерению и этапу принятия решения.'],
            ['Оценка', 'Сравниваем рекламные обращения с первыми квалификациями и продажами CRM по кампании.'],
            ['Следующий шаг', 'Проверить сценарий первого контакта и провести новый тест подачи консультации.'],
        ]))
    for pos, (channel, key, title, cols, rows) in enumerate(tables):
        table=dict(status='ok', table=dict(cols=[dict(label=c,type='string') for c in cols], rows=[dict(c=[dict(v=v) for v in row]) for row in rows]))
        raw=dict(status='ok', table=dict(cols=table['table']['cols'], rows=[dict(c=[dict(v=c) for c in cols])]+table['table']['rows']))
        insert('project_tabs', dict(id='tab_nova_demo_'+channel+'_'+key, project_id=PROJECT, channel=channel, tab_key=channel+'-'+key, source_title=title+' ('+channel+')', label=title, mode='plan' if key=='plan' else 'table', position=pos, content_json=js(table), raw_content_json=js(raw), source_hash=hashlib.sha256(js(table).encode()).hexdigest()))
    statements.append('DROP TABLE sales_demo_guard;')
    return '\n'.join(statements)+'\n', dict(project=SLUG, synthetic=True, notice=NOTICE, status='active', fromDate='2026-08-01', throughDate='2026-10-19', monthly=summaries, totals=all_totals, observations=len(facts), reports=len(reports), projectTabs=len(tables), externalIntegrations=0, capiEnabled=False)


def verify(sql, manifest):
    db=sqlite3.connect(':memory:')
    db.executescript((ROOT/'recovered/schema.sql').read_text())
    for name in ['0012_native_crm.sql', '0013_crm_messages.sql', '0014_google_compact_pages.sql', '0015_client_access.sql', '0016_password_auth.sql', '0018_crm_current_sale.sql', '0019_crm_lead_deletion.sql', '0020_daily_reviews.sql', '0021_report_attachments.sql', '0022_report_deletions.sql', '0023_platform_roles.sql', '0024_crm_meta_sync.sql', '0025_crm_meta_history_opt_in.sql', '0026_crm_boards.sql', '0027_telegram_reviews.sql', '0028_campaign_control.sql']:
        db.executescript((ROOT/'migrations'/name).read_text())
    db.execute("INSERT INTO organizations(id,slug,name) VALUES(?, 'toys-agency', 'Synthetic validation')", (ORG,))
    for _ in range(2):
        db.executescript(sql)
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert db.execute('SELECT COUNT(*) FROM leads').fetchone()[0]==manifest['totals']['leads']
        assert db.execute("SELECT COUNT(*) FROM crm_milestones WHERE kind='qualified'").fetchone()[0]==manifest['totals']['qualified']
        assert db.execute("SELECT COUNT(*) FROM crm_milestones WHERE kind='sale'").fetchone()[0]==manifest['totals']['sales']
        assert round(db.execute('SELECT SUM(amount) FROM sales').fetchone()[0],2)==manifest['totals']['revenue']
        assert round(db.execute('SELECT SUM(spend) FROM ad_metrics_daily').fetchone()[0],2)==manifest['totals']['spend']
        assert db.execute('SELECT COUNT(*) FROM integrations').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM crm_delivery').fetchone()[0]==0
        assert db.execute('SELECT capi_enabled FROM crm_projects').fetchone()[0]==0
        for m in manifest['monthly']:
            prefix=m['month']+'%'
            assert db.execute('SELECT COUNT(*) FROM leads WHERE created_at LIKE ?', (prefix,)).fetchone()[0]==m['leads']
            assert db.execute("SELECT COUNT(*) FROM crm_milestones WHERE kind='qualified' AND occurred_at LIKE ?",(prefix,)).fetchone()[0]==m['qualified']
            assert round(db.execute("SELECT SUM(CAST(value AS REAL)) FROM crm_milestones WHERE kind='sale' AND occurred_at LIKE ?",(prefix,)).fetchone()[0],2)==m['revenue']
    db.close()


if __name__=='__main__':
    sql, manifest=build()
    verify(sql, manifest)
    output=ROOT/'dist/sales-demo'
    output.mkdir(parents=True, exist_ok=True)
    (output/'import.sql').write_text(sql)
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(**manifest, verification='SQLite schema, relations, financial totals and idempotent replay passed', output=str(output)),ensure_ascii=False,indent=2))
