CREATE TABLE wiki_pages (
 id TEXT PRIMARY KEY,
 parent_id TEXT REFERENCES wiki_pages(id),
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 sort_order INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 write_token TEXT,
 updated_by TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX wiki_pages_tree ON wiki_pages(parent_id,sort_order);
CREATE TABLE wiki_revisions (
 page_id TEXT NOT NULL REFERENCES wiki_pages(id),
 version INTEGER NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 actor TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(page_id,version)
);
