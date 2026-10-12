-- Keep immutable old snapshots readable; new deliveries store one JSON page,
-- avoiding thousands of indexed row writes for a change in today's metrics.
CREATE TABLE IF NOT EXISTS google_ads_receiver_row_pages (
 snapshot_id TEXT NOT NULL REFERENCES google_ads_receiver_batches(snapshot_id),
 page_offset INTEGER NOT NULL, rows_json TEXT NOT NULL CHECK(json_valid(rows_json)),
 PRIMARY KEY(snapshot_id,page_offset)
);
CREATE VIEW IF NOT EXISTS google_ads_receiver_all_rows AS
 SELECT snapshot_id,row_key,page_offset,level,metric_date,campaign_id,ad_group_id,ad_id,payload_json FROM google_ads_receiver_rows
 UNION ALL
 SELECT p.snapshot_id,CAST(j.key AS TEXT),p.page_offset,
 json_extract(j.value,'$.level'),json_extract(j.value,'$.date'),
 json_extract(j.value,'$.campaign.id'),json_extract(j.value,'$.adGroup.id'),
 json_extract(j.value,'$.ad.id'),j.value
 FROM google_ads_receiver_row_pages p,json_each(p.rows_json) j;
