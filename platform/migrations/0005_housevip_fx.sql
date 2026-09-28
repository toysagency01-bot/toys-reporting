INSERT INTO exchange_rates (rate_date, base_currency, quote_currency, rate, source)
VALUES ('2026-09-28', 'IDR', 'EUR', 0.000048911144, 'currency-api-pages')
ON CONFLICT(rate_date, base_currency, quote_currency) DO UPDATE SET
  rate = excluded.rate,
  source = excluded.source,
  fetched_at = datetime('now');
