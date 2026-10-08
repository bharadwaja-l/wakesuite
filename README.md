# WakeSuite V9.3.11 Updated Release

Open/deploy index.html from this folder. It is the application root.

| Folder/file | Purpose |
|---|---|
| index.html | App entry point |
| js/ | Application code and communication contract |
| css/ | Approved styles |
| assets/ | Approved APT/price-update templates and four POA masters |
| docs/ | Business rules, architecture, locked formats and release history |
| qa/ | Validation results and release checks |
| firestore.rules | Existing Firestore security rules |
| TASKS_DONE.md | Changes and validation limitations |

## Git upload / replacement
Extract the ZIP, then upload the contents of WakeSuite/ into your repository's existing app root. Preserve these folder names and relative paths. Keep index.html at the configured hosting root. To replace the release, replace js/, css/, assets/, docs/ and qa/ as complete folders instead of removing individual files. Keep the previous release ZIP as a rollback copy. Git commits record folder replacements and can restore the earlier release.

## Account setup
Configure Flipkart category-specific POC Name / To / CC in Settings → System → Operational Controls before sending. Configure Amazon and internal recipients there as before. Drive API must be enabled for the configured OAuth client; authorize Drive with the intended account. WakeSuite discovers that account's own POA folders. POA generation/storage requires the existing POA/QC permission. Domain read-only sharing must be allowed by the account policy; failures are shown before an email with a broken link can be sent.

Approved formats are recorded in docs/LOCKED_FORMATS.md. Future releases must preserve them unless the user explicitly requests a change. Read TASKS_DONE.md for validation scope.
