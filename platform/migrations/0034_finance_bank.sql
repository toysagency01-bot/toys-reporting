CREATE TABLE finance_bank_state (
 id INTEGER PRIMARY KEY CHECK(id=1), data_json TEXT NOT NULL DEFAULT '{}',
 lease_until INTEGER NOT NULL DEFAULT 0
);
INSERT INTO finance_bank_state(id) VALUES(1);
CREATE TABLE finance_bank_rates (
 rate_date TEXT NOT NULL, currency TEXT NOT NULL, eur_per_unit TEXT NOT NULL,
 observed_at TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'bog_digital',
 PRIMARY KEY(rate_date,currency)
);
