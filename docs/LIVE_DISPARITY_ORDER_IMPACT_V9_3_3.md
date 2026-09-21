# Live Price Disparity — Order Impact

## Attribution
For the selected period, an order is attributed to Live Price Disparity only when the order date matches a date on which the ASIN/FSN had a raw live-price disparity that was actionable.

Raw mismatch → exception overlay → actionable date → order attribution.

## Exception treatment
An active effective Live Price exception preserves the raw mismatch but removes the overlapping date from actionable order, unit and modeled-impact totals. Historical dates are evaluated using the exception state effective on that date, not today's state.

## Metrics
- Disparity ASINs / FSNs
- Orders during actionable disparity
- Units during actionable disparity
- Amazon order revenue during actionable disparity
- Modeled revenue impact using the existing disparity-impact calculation
- Exception-excluded disparity days
- Category and fulfilment breakdowns

Orders are counted per affected identifier row. A marketplace order containing multiple affected identifiers can therefore appear in multiple identifier rows.
