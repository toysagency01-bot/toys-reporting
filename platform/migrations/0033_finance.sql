CREATE TABLE finance_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0);
INSERT INTO finance_state(id) VALUES(1);
CREATE TABLE finance_records (
 collection TEXT NOT NULL CHECK(collection IN ('accounts','projects','rules','transactions')),
 id TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)),
 version INTEGER NOT NULL DEFAULT 1, deleted_at TEXT, last_write_key TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(collection,id)
);
CREATE UNIQUE INDEX finance_external_id ON finance_records(json_extract(data_json,'$.accountId'),json_extract(data_json,'$.externalId')) WHERE collection='transactions' AND json_extract(data_json,'$.externalId') IS NOT NULL AND json_extract(data_json,'$.externalId')!='';
CREATE INDEX finance_records_live ON finance_records(collection,deleted_at);
CREATE TABLE finance_writes (
 request_key TEXT PRIMARY KEY, request_hash TEXT NOT NULL, batch_id TEXT NOT NULL,
 response_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','bog-eur','{"name":"BOG EUR","currency":"EUR","kind":"bank","opening":null,"openingDate":null}');
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','bog-usd','{"name":"BOG USD","currency":"USD","kind":"bank","opening":null,"openingDate":null}');
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','bog-gel','{"name":"BOG GEL","currency":"GEL","kind":"bank","opening":null,"openingDate":null}');
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','bog-gbp','{"name":"BOG GBP","currency":"GBP","kind":"bank","opening":null,"openingDate":null}');
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','usdt-main','{"name":"USDT TRC20","currency":"USDT","kind":"crypto","opening":null,"openingDate":null}');
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','usdt-fund','{"name":"Фонд USDT","currency":"USDT","kind":"fund","opening":null,"openingDate":null}');
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','paypal-eur','{"name":"PayPal €","currency":"EUR","kind":"paypal","opening":null,"openingDate":null}');
INSERT INTO finance_records(collection,id,data_json) VALUES('accounts','paypal-usd','{"name":"PayPal $","currency":"USD","kind":"paypal","opening":null,"openingDate":null}');
