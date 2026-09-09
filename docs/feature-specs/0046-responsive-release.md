# 0046 — Responsive task lifecycle and measured installation

Owner requests a final reliability review, faster installer, and public source,
installer and update packages after privacy review (2026-09-09).

Acceptance: busy sessions reconcile independently; polling does not repeatedly
reload full transcripts; Stop remains scoped to the selected run and never
claims cancellation without acknowledgement. Missing native wait receipts can
recover from explicit idle history, but must not imply successful review.
Installer reuse uses bounded concurrency and retains per-file hash/path checks,
immutable old versions, retry and separate persistent user data. Measure the
exact new installer before publishing; report any remaining limitations.

Keep native core unchanged, proportionate approvals and reviewer-only Advisor.
Test real packaged lifecycle, concurrent sessions and document exports. Publish
reviewed source and artifacts to ai-for-boss-preview; never private history.
