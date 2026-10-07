# Locked formats — 07 Oct 2026

This contract consolidates the user's approved corrections and supersedes conflicting older release descriptions. Preserve it in future releases until the user explicitly requests a change.

| Area | Locked behavior |
|---|---|
| Amazon escalation | New message each time; first send unnumbered, subsequent sends Escalation - 2, - 3. Current selected-day actionable data only; retain send history. |
| Time | Actual send/download time, 12-hour AM/PM with minutes; filenames use HH-MM-AM/PM. |
| Combined Amazon POC | Live Price Disparity / ASIN Suppression / Buy Box Suppression / Total; unique ASIN counts and Rev Impact / Day; separate attachments and mandatory APT when Buy Box exists. |
| Live Price individual POC | Category / Seller SKU / ASIN / Price; Price is marketplace live price. |
| Suppression individual POC | Full current list inline, no Excel: Category / ASIN / Rev Impact / Day / POA; ASIN link text; no Escalated On. Standalone and Send All share selected-day issue selection. |
| Drive / POA | Authorized account's own root/category folders; correct category master; replace all ASIN references and product title across runs; preserve layout/media; bind to suppression occurrence; re-suppression creates a new occurrence; company read-only sharing and clear failures. |
| Normal suppression report | Match visible filters/date range/columns/rows/order; omit Action/Override and hidden columns; no injected POA or Escalated On. Normal sharing is independent from POC. |
| Buy Box POC | Category / No. of ASINs / Rev Impact / Day / totals; report plus mandatory APT. Correct mapped WF Price and calculated WakeSuite impact. |
| Buy Box APT | Approved code/template unchanged: WF SKU, Category and WF Price mappings, one ASIN/WF SKU per row. Failure blocks POC send. |
| Flipkart POC | Live Price only, category-specific POC Name / To / CC and separate sends. Category / FSN / WF Item SKU / WF Price / FK Live Price / Diff inline and matching attachment; unresolved rows only. |
| Normal Flipkart sharing | Selected filters/period, inline, no attachment by default. |
| Internal report | Hi Team; category issue counts, total identifiers and whole-rupee revenue; Amazon/Flipkart total impact and Total Marketplace Impact. |
| Daily workbook | Summary mirrors email plus AZ Live Price, AZ ASIN Suppression, AZ Buy Box Suppression, FK Live Price; SKU-level calculated impact, no Listing/MRP tabs, no invented FK revenue. |
| Revenue | Whole rupees for presentation/exports; calculation precision remains unchanged; unavailable revenue stays explicit. |
| Price disparity sharing | Current filtered/visible rows and resolved identifiers; correct unique count; invalid IDs block sharing. |
| Report controls | Download Excel and Share via Email remain independent; Listing/Live/MRP choices retained; no All Disparities. |
| Orders | Evidence stays in dedicated Disparity Orders; embedded panel retired; no historical attribution changes or orders in POC. |
| Startup | Retain shell-first/latest snapshot/background startup and lazy DOCX engine; coalesce snapshot requests and cache POA masters. |
| Scope | No Flipkart Buy Box, broad redesign, fabricated revenue or APT rule changes. |

Communication log adds channel, category, escalationNumber, cc, identifiers, subject, gmailId and sentAtIso to existing records. Operational controls adds flipkartPocByCategory. Existing Firestore permissions/rules are retained. Locally mocked tests cannot confirm production OAuth/API/domain policy or persistence.
