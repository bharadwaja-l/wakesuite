# Marketplace automation trial

Data Center launches the signed-in seller portals and SQL Explorer in Chrome, then displays status received from the updated Tampermonkey helper. Retrieval uses the sites' visible controls and Chrome downloads only. There are no report API calls, direct download URLs, security setting changes or browser-download-history permissions.

## Try it

1. Use the trial branch locally or merge/deploy this PR to the existing Wakesuite GitHub Pages site. The helper bridge is scoped to `https://bharadwaja-l.github.io/wakesuite/`; a local preview can display the panel but cannot connect to the bridge.
2. In Data Center, open **Install / update Marketplace Reports Workflow Helper v2.2.0**, and install it in Tampermonkey. Replace the existing helper rather than keeping two copies enabled. Approve its userscript storage grants; those store task status across the allowed sites. Refresh Wakesuite and the report tabs after updating.
3. Check **Helper connected**, then run one report as a trial. Keep Chrome signed in. Use the site's normal login if needed.
4. Check dates and report type in the portal. Amazon ASIN Sales, Amazon All Orders and Flipkart Orders target the 30 completed calendar days ending yesterday. All Orders uses Custom dates and Order Date, and stops before requesting if it cannot verify the controls.
5. Confirm the file completes in Chrome Downloads and inspect its contents/date range. Then try **Run all daily reports**. If Chrome blocks extra tabs, run the blocked tasks individually. Portal generation may take minutes; do not repeatedly request it.

## What the status means

- **Running** reflects the helper's current step. Each task reports timestamps and the portal message. Finished actions and tasks needing attention appear separately.
- **Download clicked / finished action** means the site's control was clicked, not that Chrome verified a complete file. Today-download markers track helper click actions, not actual browser downloads or manual downloads.
- **No recent update** means the report tab may be closed, unloaded or throttled; it is not proof of failure. Check that tab before starting another workflow.
- **Helper connected** means the userscript is responding on Wakesuite; each seller portal still needs its own session and script access.
- No report data is transmitted to Data Center by this bridge, only bounded progress text. Status records expire after seven days when Wakesuite opens. The active trial is retained in session storage across reloads of the same Wakesuite tab.

## Download behavior and limits

- Amazon inventory report types are selected and verified before request. Report status is refreshed periodically. Failed generation tries a completed prior file before retrying; request attempts remain capped at three. An inventory download technical error also attempts a prior completed file. Prior files are explicitly flagged as fallback; their recency/content must be checked in Chrome.
- Amazon All Orders tracks the new batch. It accepts Request or Request Report controls and ordinary Download links. A failed Orders request does not silently substitute an older report whose date range is unknown.
- Flipkart's **Download latest completed Listing file** never generates. The workflow reuses it only when Seller Hub exposes a size over 20 MB; 20 MB or smaller triggers generation. If size is absent, it pauses for a manual Chrome Downloads check instead of guessing. Use the separate Generate button after checking. Fresh generation waits for a new filename, excluding previously completed files, and stops if identification is ambiguous.
- SQL always inserts/verifies the exact active-products SELECT, arms its normal form submission and runs it before export. It no longer reuses a table merely because its headers match. Resume requires both expected query text and five expected result headers. CSV activates a visible native control. If an inline `ERR_BLOCKED_BY_CLIENT` is observable, the same control is retried once. A separate Chrome error page cannot be inspected by a seller-site userscript; return to SQL Explorer and retry its normal control once manually.
- Within a helper tab all action buttons are disabled while a task runs. Data Center blocks duplicate starts for its pending tasks. Independently starting the same task in unrelated browser tabs is not globally coordinated; use one Data Center trial at a time.

## Validation

Run `node qa/marketplace-automation-validation.cjs` plus `node --check` on the controller and userscript. Mocked checks cover rolling dates, strict file-size threshold/fallback, unknown-size pause, SQL execution, helper handshake, foreign-message rejection, duplicate starts and terminal status cleanup. Static guards check custom date selection, fresh-row tracking and SQL result validation. Live authenticated portal selectors and end-to-end timings still need trial verification.

This change does not import BRAD Inbox, snapshot live scraping results, alter the BRAD workbook/Apps Script, or delete Drive files. Historical storage and cleanup require a separate verified import workflow.
