# Profkit cost per sale and ROAS

The earlier coverage guard was too strict: a single blank sales or revenue day
hid both ratios across the entire selected period, even when entered sales,
revenue and confirmed UAH expenses were available. In the actual seven-day
October 30–November 5 period, four days had entered sales/revenue and three were
unfilled. A read-only reconciliation confirmed that currency conversion and
both ratios were calculable.

The dashboard now keeps the native same-period formulas:

- Cost per sale = all confirmed advertising expenses in the selected period ÷
  the entered sale count in that period.
- ROAS = entered revenue in the selected period ÷ all confirmed advertising
  expenses in the same period.

Each ratio has its own input coverage. Missing revenue does not block cost per
sale, and a missing sale count does not block ROAS. An incomplete denominator or
revenue source marks the available ratio **Предварительно**, with an explanation
of the whole-period expense basis and entered-day coverage. Complete selected
periods show the unannotated ratio. The overview insight also identifies
provisional ROAS without concatenating annotation text into its number.

No sale denominator, zero spend for ROAS, unknown expenses or an unavailable
required positive-spend FX rate still produce an em dash. Observed zero revenue
can produce zero ROAS. Zero USD expenses need no FX rate to establish zero UAH
expenses. Unknown qualification counts remain unknown and do not block these
sales ratios.

Validation: 364 regression tests and seven desktop/mobile browser checks passed.
Cases cover partial and complete periods, independent sales/revenue coverage,
observed zero revenue and missing FX. Actual project data was checked through
the normal read-only source service and daily currency conversion. No source
data, account history or permissions changed.

Published Worker: `a245cdd0-2089-43ba-93ac-a262a297dea5`.
