# Profkit: remove unused CRM results

The user confirmed that Profkit does not use a CRM and requested removal of its
overview CRM results block and CRM qualifications in campaign breakdowns.

Profkit's `showCRMResults: false` registry setting now prevents the overview
from creating a CRM results panel or polling CRM summary results. The campaign
API skips qualification aggregation, and the browser also ignores old cached
qualification metadata. Qualification/CPQL columns, their sort options and CRM
matching notes are hidden. The advertising cache revision was bumped.

This setting applies only to Profkit. Advertising, client-table sales/revenue,
cost per sale and ROAS remain. No project records, historical data, permissions
or credentials were changed.

Validation: 20 existing campaign/asset checks and seven Profkit browser checks
passed. Additional desktop/mobile inspection deliberately supplied an old
`crmQualification.enabled: true` response and confirmed that the overview CRM
panel, campaign qualification columns and sorting remained absent.

Worker: `551d7085-7709-499f-a90c-1e7b7c59e386`.
