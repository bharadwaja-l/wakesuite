# Amazon Buy Box APT — V9.3.7

## Scope
This release implements only Amazon Buy Box APT generation. POA and QC document generation remain deferred to a later upgrade.

## Trigger
APT generation is available from the Amazon Buy Box Suppression report. Users can generate:
- one APT for all currently filtered Buy Box suppression rows; or
- one APT from an individual Buy Box row.

## Template
WakeSuite uses `assets/BuyBox_APT_Template.xlsx`, the user-provided APT workbook, as the base template.

## Locked field mapping
- Marketplace ID: fixed value retained from the APT template.
- ASIN: affected Amazon Buy Box-suppressed ASIN.
- Seller ID: fixed value retained from the APT template.
- Merchant SKUs: WF SKU mapped to the ASIN.
- GL: WakeSuite Category.
- Landed Price at which listing got suppressed: WF Price.
- TICO Link: generated with the template's TICO URL pattern using Marketplace ID, ASIN, WF SKU and WF Price.
- Brand Manufacturer/Competitor product URL: Wakefit URL pattern retained from the supplied template.
- Brand Manufacturer/Competitor product Price: WF Price.
- Shipping price: WF Price.
- Custom Override Values in case L7/+ approval is obtained: WF Price.

## Atomic mapping
If one ASIN resolves to multiple distinct WF SKUs in the active Buy Box-suppression snapshot coverage, WakeSuite creates separate APT rows. It does not concatenate WF SKUs.

## Validation
APT generation stops instead of creating an incorrect file when ASIN, WF SKU, Category or WF Price is missing.

## Resolution rule
Generating an APT does not mark Buy Box suppression as resolved. Marketplace truth remains audit-driven; the issue is resolved only after a later valid audit shows Buy Box available.
