# POA / QC template scope

- POA categories currently configured: Mattress, Office Chairs, Furniture, Accessories. Only ASIN and Product Title are dynamic; Office Chairs canonical template includes Amazon Q&A.
- Mattress QC: model templates; production generation fills SKU ID, ASIN and Date only and preserves the one-page visual layout/photos.
- Office Chairs QC: ASIN-specific PDF templates; production generation changes only the date.
- Furniture and Accessories QC are not configured yet.
- Generated production documents should be stored through the configured Super Admin Drive upload endpoint and exposed by read-only share URL to users with Suppression Management access.
