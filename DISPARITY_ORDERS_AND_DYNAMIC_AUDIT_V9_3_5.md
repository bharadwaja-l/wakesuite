# WakeSuite V9.3.5 — Disparity Orders + Dynamic Audit Schema

## Disparity Orders
Navigation: `Amazon → Price Disparity → Disparity Orders`

Qualification rule:
- source order must be Amazon Order Report,
- order purchase date must fall inside the selected period,
- the same ASIN/AZ SKU must have raw Live Price Disparity on that exact date.

The page does not include general Amazon orders and does not use Listing/MRP disparity alone.

## Dynamic Audit Report schema
The Audit Report parser no longer uses fixed column numbers. It detects the header row, canonicalizes header names, validates required headers, and reads values by header name. New columns and column reordering therefore do not change field interpretation.


## V9.3.5.1 navigation hotfix
The new `amazonDisparityOrders` module is treated as a child of `amazonLive` for backward-compatible access. Older user scope records therefore do not hide the menu after authentication.
