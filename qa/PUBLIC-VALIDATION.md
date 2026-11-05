# Public reviewer validation

Date: 5 November 2026. Scope: separate browser-only CivicLedger reviewer edition.

## Passed in the build workspace

- `npm test`: **41 passed, 0 failed, 0 skipped**. Includes 18 unchanged engine tests, 9 sample tests, and 14 new session tests.
- `npm run typecheck`: passed with strict TypeScript checking.
- `npm run lint`: passed. The only inherited-engine exception permits its two existing unused type imports, `Claim` and `Finding`, so reviewed engine bytes remain unchanged.
- `npm run build`: passed with Vite 8.0.13. Production output contains static HTML/CSS/JS, a local SVG favicon, and third-party license notices. No server bundle is produced.
- `npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund`: regenerated the minimized lockfile successfully. It contains 206 package entries with only public npm registry resolved artifacts.
- Byte comparison: engine, fixtures, types and engine tests match the reviewed private v5 files exactly. The sample helper differs only by removing an unused disabled-live class and changing one supplement label from "saved" to "temporary". The corresponding disabled-live assertion was removed from its tests.

## Automated coverage

- All nine fictional fixtures and all four sample presets have valid case-scoped exact citations.
- Seeded $300 income conflict and missing statement remain unresolved; gross/net and period mismatches produce no difference calculation.
- Unreadable, missing-manifest, partial-manifest and cross-case inputs block ready drafts conservatively. Embedded injection text remains inert.
- Exact reference validation rejects wrong case, missing or duplicated document identity, wrong version/hash/page, altered excerpts and invalid ranges. Both private-v5 duplicate-reference regressions are retained.
- Unsupported draft edits block acceptance, while explicit rejection with a note is allowed. Incomplete evidence never becomes acceptable through editing.
- Acceptance requires acknowledgment and checks source-set SHA-256 plus all evidence, claim, finding and draft references. Source/case/version/revision mismatch and changed text fail closed.
- Isolated session instances cannot read one another's runs. Returned clones cannot change internal state.
- Concurrent stale changes do not overwrite newer state. Same-payload replay is idempotent; changed-payload or cross-run request-ID reuse is rejected.
- Reset invalidates pending starts and mutations. Run/event/request/text limits bound memory.
- Exported JSON explicitly labels the data fictional, local, simulated and non-authoritative.
- Sample cancellation and newer questions invalidate earlier responses.

## Source and production boundaries

The allowlisted tree excludes original authentication, API routes, database code, live Astra/client code, unused connectors, deployment identity, account details, private Git history and unapproved evidence. App code contains no fetch, XHR, WebSocket, beacon, upload, storage, cookie, service-worker or live-model implementation. The Vite modulepreload fetch polyfill is disabled. Production CSP uses `connect-src 'none'`; CSP is an additional boundary, not a substitute for code review. Official-resource links are fixed, case-free and no-referrer. Their current content/availability is not verified by this demo.

These are illustrative browser workflow guards, not trusted authentication, durable persistence, or tamper-proof controls. No SQL integration or live watsonx integration is present or claimed.

## Verification limits and remaining release checks

- **Clean installation and reproduction passed:** an initial offline installation stopped at an uncached tarball. A subsequent new isolated copy completed ordinary registry installation with `npm ci --ignore-scripts --no-audit --no-fund`, using a workspace-local cache without global settings or network changes. It installed 176 packages, passed all 41 tests, strict typecheck, lint and production build, left its 25 source inputs unchanged, and emitted exactly the same five artifact paths and SHA-256 hashes. No dependency symlink was used in this clean reproduction. Dependencies are not included in the public source.
- **Production static browser QA:** all nine fixtures produced the expected statuses and findings. The seeded M01 citation highlighted exactly lines 2–4. An unsupported eligibility sentence was retained as unverified and blocked acceptance; restoring suggested text, keeping a new version, explicit acknowledgment and acceptance succeeded. Rejection with a fictional note also succeeded. A second browser tab had no runs; reload and Reset cleared temporary state, while canceling Reset preserved it. Incomplete evidence blocked the draft. Sample response/dismissal and ArrowRight tab navigation worked. Desktop visual inspection passed. The rendered CSP contained `connect-src 'none'` and `form-action 'none'`; the page had one local script and no form or file input. This was the production build on a local static preview, not evidence of deployed access.
- **Browser limits:** mobile viewport, back/forward-cache behavior, download UX and a full network trace were not exercised in this pass. Browser-console output sampled during the run contained browser-extension metadata errors, not an identified application error. Unit tests and static source/bundle review supplement, but do not replace, those unperformed checks.
- **Publication is a separate gate:** this source validation does not prove a public repository, unauthenticated deployed access, deployment provenance, or competition submission.
- **Published prototype checked:** the public demo rendered without an application sign-in, and its seeded findings, exact manifest highlighting, acknowledgment-gated simulated acceptance, and reload clearing were exercised on the deployed page. Initial unauthenticated HTTP requests returned 200 for all five static artifacts and matched the local SHA-256 hashes exactly. The host set infrastructure cookies. A later metadata-only HTTP request returned 403; it was not retried or worked around. The live browser workflow remained usable. Repository publication and competition submission remain separate gates.
- No claim is made that the original private app's database/security tests apply to the public in-memory implementation.

## Artifact identity at implementation handoff

- JavaScript: `assets/index-DNcKBGjh.js`, SHA-256 `25d12a03e319aec9ea1a3e0bcd79c2a4df84d123aa9ca0466ad821b1cc521fb3`.
- CSS: `assets/index-Cyc-0Ye4.css`, SHA-256 `62ac7d12f79287863baecaa1e661fc18b671177d3766fe6fb1ce10a894b202e5`.
- HTML: `index.html`, SHA-256 `694f6496de61f75dd46bc9adac53e557fd5832196d093dfd228ec90eb9cb7af9`.

Record a new public commit and deployed artifact identity after any source or hosting transformation. This report includes no original private project identity or private history.
