# WakeSuite Change-Control Standard

This document is the rule for all future WakeSuite code changes.

## Required for every change
1. Update `CHANGELOG.md` before deployment.
2. Record the version and date.
3. State the user-facing change.
4. State the business-rule change, if any.
5. State the files changed.
6. Record migrations/backward-compatibility impacts.
7. Record testing performed and any untested external dependency.
8. Update `docs/BUSINESS_RULES.md` whenever a calculation, eligibility, exception, permission, or marketplace-output rule changes.
9. Update `docs/ARCHITECTURE.md` whenever files, storage, modules, or data flows change.
10. Update `docs/FIRESTORE_V9_1.md` whenever collections/fields/security requirements change.

## Versioning
- Patch (`9.1.1`): bug fix with no intentional business-rule change.
- Minor (`9.2.0`): new module/feature or intentional workflow/rule enhancement.
- Major (`10.0.0`): architectural/data-model break or major product redesign.

## Commit-message convention
Recommended format:

```text
WakeSuite V9.1.1: fix Amazon Max SAP preview
```

## Production validation checklist
- JavaScript syntax checks pass.
- HTML parses without fatal structure errors.
- All inline UI handlers resolve to code functions.
- No retired feature is visible in navigation.
- Role/category scopes tested.
- Super Admin full access tested.
- Amazon update workbook opens and key columns are populated correctly.
- Flipkart CSV header/order verified against the latest uploaded listing file.
- Exception changes update actionability without converting exceptions to parity.
- Data Administration does not delete raw uploads.
- Live Firebase/auth/Gmail actions tested in deployed environment when affected.
