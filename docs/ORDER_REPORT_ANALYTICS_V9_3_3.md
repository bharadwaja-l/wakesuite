# Order Report Analytics — V9.3.3

## Scope
Amazon Order Report and Flipkart Order Report remain analytical sources for three approved uses:
1. Pricing Exception Insights
2. Live Price Disparity order impact
3. Inventory History velocity / DRR analysis

They are not a replacement for Amazon Business Reports or marketplace inventory snapshots.

## Amazon
- Order ID: `amazon-order-id`
- Order date: `purchase-date`
- AZ SKU: `sku`
- ASIN: `asin`
- Units: `quantity`
- Revenue: `item-price`
- Fulfilment: `fulfillment-channel`, normalized to FBA / FBM where recognizable

Mapping: AZ SKU → ASIN → WF SKU → Category. Raw FBA/FBM is retained; business views can aggregate at ASIN without duplicating the ASIN.

## Flipkart
- Order ID: `order_id`
- Order date: `order_date`
- FSN: `fsn`
- Units: `quantity`
- Fulfilment context: `fulfilment_source`, `fulfilment_type`
- Current listing fulfilment: `Fulfillment By` from Flipkart Listing File

The provided Flipkart Order Report contains no revenue field. WakeSuite therefore does not manufacture Flipkart order revenue.
