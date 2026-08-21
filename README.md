# WakeSuite V9.1.1

WakeSuite V9.1.1 is the 21 Aug 2026 performance and UI hotfix on top of the V9.1 operations + decision-intelligence build.

## Deploy
Upload the **contents of this folder** to the root of the existing GitHub Pages repository, preserving paths:

```text
index.html
css/wakesuite.css
js/wakesuite-app.js
js/wakesuite-v9.1.js
js/wakesuite-firebase.js
assets/PriceAndQuantity.xlsm
CHANGELOG.md
docs/...
```

Do not upload the ZIP as the website and do not place `index.html` one folder below the repository root.

## Important V9.1 behavior
- Amazon update output uses `assets/PriceAndQuantity.xlsm` supplied on 21 Aug 2026.
- Flipkart update output uses the latest Flipkart Listing File uploaded through Data Center for the selected date and downloads CSV.
- Pricing Exceptions are an overlay on raw marketplace issues; approved exceptions are not parity.
- Marketplace Insights contains Overview, Pricing Insights, and Inventory Insights.
- Super Admin is authoritative full access.
- Data Administration clears processed analysis only and records an audit event.

## Documentation
- `CHANGELOG.md` — every production code change.
- `docs/BUSINESS_RULES.md` — calculation/workflow rules.
- `docs/ARCHITECTURE.md` — technical layout and data flow.
- `docs/CHANGE_CONTROL.md` — mandatory documentation/testing process for future changes.
- `docs/FIRESTORE_V9_1.md` — persistence additions and security deployment notes.

## Validation performed for this package
- JavaScript syntax checks (`node --check`) on all three JavaScript files.
- HTML parse validation.
- Static validation of inline UI handler names.
- Verification that the packaged Amazon template is byte-identical to the supplied `PriceAndQuantity.xlsm`.
- Retired Flipkart Buy Box UI removed from V9.1 HTML.
- Obsolete Amazon template and large Flipkart reference file removed from the deployable package.

## Live-environment checks still required after deployment
Firebase authentication, Firestore Security Rules, Google Sheets OAuth, Gmail actions, and marketplace file acceptance depend on the deployed account/project and cannot be fully exercised by an offline static validation pass.


## V9.1.1 hotfix

This release focuses on responsiveness and navigation quality:

- Dashboard no longer loads Data Health or Update Verification.
- Action Center is lightweight and background-refreshes workflow data.
- Exception application is indexed and cached per snapshot.
- Mobile sidebar backdrop no longer uses blur.
- Desktop and collapsed sidebar alignment are corrected.

See `CHANGELOG.md` for the exact code-change record.
