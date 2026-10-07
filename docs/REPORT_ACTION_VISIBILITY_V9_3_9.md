# WakeSuite V9.3.9 — Individual Report Action Visibility

## Locked behavior
- Generic individual reports: **Download Excel | Share via Email**.
- Buy Box Suppression: **Download Excel | Generate Buy Box APT | Share via Email**.
- Price Disparity Explorer: **Download Excel | Share via Email**.
- Disparity Orders: **Download Excel**.
- Marketplace Insights: **Download Excel**.

## Implementation
- Action containers wrap within the report width and are never allowed to force page-level horizontal overflow.
- Download/Email buttons are explicit non-shrinking actions; period/date controls wrap around them.
- A runtime guard checks that required buttons exist after startup/pageshow and recreates only a missing action button.
- Conditional Buy Box APT visibility remains controlled by the existing V9.3.7 logic.

## Non-goals
No report calculations, filters, identifier mapping, email counts, POC sending, APT mapping, disparity-order logic, Firestore logic, or upload processing changed in this release.
