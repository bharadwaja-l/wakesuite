# Amazon and SQL import trial

Data Center includes **Import Amazon + SQL downloads**. This is a direct local-file import; it does not use Google Drive, BRAD Inbox or the BRAD Apps Script. Flipkart and audit files are excluded.

1. Download the reports in Chrome using the helper or the normal portal controls.
2. Open Data Center and choose the downloaded files together in the new import panel.
3. Review **Report Date**, detected source, file name, row count and order-file coverage. Choose one file per source type. The batch supports Wakefit SQL Daily Pricing, Amazon All Listings, Amazon FBA Inventory, Amazon Business Reports / ASIN Sales and Amazon All Orders.
4. If importing ASIN Sales, confirm its actual Data From / Data To dates. The fields are prefilled for the helper's rolling 30 completed days ending yesterday, but must be checked against the file/export. Orders coverage is read from its order dates.
5. Click **Import selected reports**. Each file uses the existing source validation, metadata registration, source cache and raw-file version cache. A failure is reported per file. Processing of the available sources runs once after the batch.
6. Check the final snapshot message. **Imported** means the normal upload receipt was returned; **Firestore snapshot verified** means a completed snapshot matching the current source fingerprint was read back. Pending snapshots, missing mappings, failures and retained more-complete snapshots are not reported as new verified cloud snapshots.

Files are classified by required headers, not names. Unrelated SKU files are not accepted as All Orders; order ID and order date columns are also required. The trial accepts up to ten files for review, each up to 200 MB. Duplicate source types must be deselected before import.

SHA-256 receipts in this browser skip identical contents for the same user, Report Date, source and coverage. The explicit re-import checkbox can override that skip. This is not cross-browser cloud deduplication. Failed imports are not marked successful. Existing overlap checks for Business Reports remain enforced.

The standard upload form remains available. Batch imports have explicit file/date/config inputs, reuse the parsed preview and avoid modal alerts; manual uploads retain their existing UI. The manual upload button and Report Date are locked during the batch. Existing upload permissions and source-type scopes are enforced.

Amazon processing no longer requires a Flipkart mapping when only Amazon's mapping and processable sources are present. Flipkart calculations still require their own mapping and reports. Existing safeguards against replacing a more-complete snapshot with fewer sources remain intact.

The browser cannot automatically read Chrome's Downloads folder or import a file solely because a download button was clicked. Selecting local files is required in this trial. No helper update is needed for import.

Raw report files are cached in this browser by the existing uploader; they are not uploaded as raw files to cloud storage. Import receipts and processed Firestore chunks are not a promise of a complete raw-file archive. Keep originals until historical output is verified. Nothing deletes files from Drive or the computer.

Validation: `node qa/download-import-validation.cjs` covers supported source detection, exclusion of Flipkart/unrelated files, exact-content dedupe, date isolation, confirmed sales coverage, source ordering, one processing pass, access checks, failed-write retry, honest snapshot status, the actual base uploader, and Amazon snapshot processing without Flipkart mapping. JavaScript syntax checks also pass. Live authenticated import and Firestore verification need the user's selected files and account.
