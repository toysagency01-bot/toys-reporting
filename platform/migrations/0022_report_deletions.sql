CREATE TABLE IF NOT EXISTS report_deletions (
 organization_id TEXT NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(id),
 report_kind TEXT NOT NULL CHECK(report_kind IN ('content','imported')),
 report_id TEXT NOT NULL,
 actor_ref TEXT NOT NULL,
 deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(organization_id,project_id,report_kind,report_id)
);
-- A save already in flight must not republish or modify an archived report.
CREATE TRIGGER IF NOT EXISTS archived_report_write_guard
BEFORE UPDATE OF latest_revision_number,published_revision_id ON content_items
WHEN OLD.lifecycle='archived' AND (NEW.latest_revision_number != OLD.latest_revision_number OR NEW.published_revision_id IS NOT OLD.published_revision_id)
BEGIN SELECT RAISE(ABORT,'report_archived'); END;
CREATE TRIGGER IF NOT EXISTS archived_report_revision_guard
BEFORE INSERT ON content_revisions
WHEN EXISTS (SELECT 1 FROM content_items WHERE id=NEW.content_item_id AND lifecycle='archived')
BEGIN SELECT RAISE(ABORT,'report_archived'); END;
