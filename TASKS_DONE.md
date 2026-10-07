# TASKS_DONE / CHANGELOG — WakeSuite V9.3.11 Updated

Base: WakeSuite_V9_3_11_POC_POA_Sale_Readiness.zip. Updated 07 Oct 2026.

## Completed
- Re-escalations refresh selected-day data, include currently actionable new and previously escalated rows, and send new messages. Per-channel numbering starts without a label, then Escalation - 2, - 3; each send retains recipients, identifiers, number, subject and Gmail ID in history.
- Email subjects/attachment filenames and manual Excel filenames include actual 12-hour time with minutes.
- Preserved Amazon combined summary/separate attachments and Live Price POC Category / Seller SKU / ASIN / Price format. Suppression POC stays inline without Excel; POA link text is the ASIN. Buy Box POC shows category counts/whole-rupee impact plus report and mandatory APT.
- Flipkart POC settings now contain category, POC name, To and CC. Sends are separated by category with matching actionable-row attachments.
- Normal report downloads/shares use visible report columns, rows and order, excluding UI actions/hidden columns. They do not generate POAs or inject POC columns. Normal Flipkart sharing stays inline without attachment.
- Corrected Buy Box WF Price lookup from selected snapshots; retained calculated impact instead of substituting listing price or fabricated revenue.
- Daily report uses Hi Team, Amazon/Flipkart summaries and marketplace total; Excel contains Summary plus AZ Live Price, AZ ASIN Suppression, AZ Buy Box Suppression and FK Live Price. Unavailable revenue remains explicit.
- Drive folders are found/created under the account authorizing Drive: WakeSuite POA Library and four category folders. Cached IDs are account-scoped. Stale/resolved suppression occurrences are excluded; POA text replacement handles split Word runs while retaining template media/layout. Storage confirmation and upload/sharing errors block broken-link emails.
- Added snapshot request coalescing and POA master caching; retained shell-first/background startup and lazy DOCX engine loading. Retained separate report controls and dedicated Disparity Orders behavior.
- Organized runtime into js/, css/, assets/; reference/history documents into docs/; checks into qa/. Added the locked format contract and upload guide.

## Validation
All JavaScript syntax checks, local index references, full-app startup smoke test, mocked communication/Drive/failure regressions and actual four-master POA replacement checks passed. Approved APT code and all bundled assets/templates are unchanged byte-for-byte. Final ZIP entries are CRC-tested and compared with release files.

Live Gmail delivery, OAuth consent, Drive domain-sharing policy and Firestore writes require validation in the deployed authorized account; those integrations were mocked locally. No real email was sent and no deployment was performed.
