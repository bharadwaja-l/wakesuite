# Inventory DRR and Sell-Through — V9.3.3

## DRR
`DRR = Units Sold / Selling Days`

Selling Days means distinct dates with order units in the selected period.

## Inventory History
Inventory History combines marketplace inventory snapshots with Order Report units to show: Opening Inventory, Closing/Latest Inventory, Units Sold, DRR, Days of Cover, OOS Days, OOS %, stock movement and fulfilment context.

## Sell-through distinction
True Sell-Through requires receipts/inbound quantities:
`Units Sold / (Opening Inventory + Units Received) × 100`

If receipts are not available, WakeSuite does not label the metric Sell-Through. V9.3.3 shows `Sales vs Opening Stock %` as a velocity context metric instead. Values above 100% can occur when replenishment occurred during the period.

## Days of Cover
`Current Inventory / DRR`
- Critical: <3 days
- At Risk: 3–7 days
- Watch: >7–14 days
- Healthy: >14 days
