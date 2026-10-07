# V9.3.11 — POA + POC Locked Flow

## Suppression POA
ASIN suppression → locate current suppression occurrence → reuse stored POA link when present → otherwise resolve category + Amazon title → copy bundled category POA master → replace sample ASIN and product title only → upload generated `<ASIN>.docx` to the category Drive folder → grant Wakefit-domain read-only link access → save Drive file ID/link to the suppression occurrence.

Categories: Mattress, Furniture, Accessories, Office Chairs.

## Amazon POC
Combined Daily Escalation keeps the approved consolidated summary and sends three issue-specific workbooks plus Buy Box APT when required. Suppression POA links are inline beside the ASIN.

Individual Live Price Disparity keeps ASIN count + attachment. Individual ASIN Suppression is inline `Category | ASIN | Rev Impact | POA Link` and does not show Escalated On in the email body. Individual Buy Box sends report + APT.

## Flipkart POC
Live Price Disparity is presented directly in the email body as `Category | FSN | WF Item SKU | WF Price | FK Live Price | Diff`. Excel is downloaded separately from the report page when needed.

## Revenue impact
All POC/email/export revenue-impact values in this flow display as whole rupees. Internal calculations keep full precision.
