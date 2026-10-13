-- Preserve first-conversion history for reporting/CAPI while the board uses
-- the current deal amount and stage. Backfill only uninitialized deal amounts.
UPDATE crm_lead_state SET
  sale_value=(SELECT m.value FROM crm_milestones m WHERE m.lead_id=crm_lead_state.lead_id AND m.kind='sale'),
  sale_currency=(SELECT m.currency FROM crm_milestones m WHERE m.lead_id=crm_lead_state.lead_id AND m.kind='sale')
WHERE sale_value IS NULL AND sale_currency IS NULL
  AND EXISTS(SELECT 1 FROM crm_milestones m WHERE m.lead_id=crm_lead_state.lead_id AND m.kind='sale');
