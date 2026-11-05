# Public reviewer release notes

Date: 5 November 2026. Edition: browser-only reviewer prototype 1.0.0.

- Created a new allowlisted source tree. The original private application was not modified.
- Preserved the reviewed v5 deterministic engine, fixtures, types and engine tests byte-for-byte, including both duplicate-reference regressions.
- Retained all nine synthetic fixtures, source-highlight viewers, source-grounded draft verification and unresolved/incomplete findings.
- Removed private authentication, HTTP API, D1 database, identity bridge, private deployment configuration, live Astra panel/client and unused connector runtime.
- Added bounded in-memory session state, exact-source acceptance checks, explicit review acknowledgment, stale/version/replay checks, concurrency/reset guards and 14 session tests.
- Added prominent fictional-only and temporary-state labels. Reset and reload clear state. Optional JSON is a local, labeled, non-authoritative download, never a server export.
- Kept deterministic preset sample explanations and fixed official-resource links. Removed the unused disabled-live class and its single assertion from the sample tests; changed one supplement phrase from "saved" to "temporary". No other sample algorithm changed.
- Replaced framework/server scaffolding with Vite/React and explicit CSS. Removed the Tailwind import and unused live-only styles. No private framework or vendor helper was copied.
- Minimized and pinned package dependencies. The regenerated lockfile contains 206 entries. Third-party runtime license texts accompany source and built assets; no new blanket license grant was added.
- Added production CSP with `connect-src 'none'`, no-referrer metadata/links, no modulepreload fetch polyfill, and no browser storage for review data.

## Validation scope

Forty-one tests, strict typecheck, ESLint and production build passed for this edition. Those results do not imply private database tests or live-model integration were executed. After an initial offline cache miss, a fresh isolated `npm ci --ignore-scripts` using the ordinary public registry completed successfully. It passed the same checks and reproduced all five production artifacts byte-for-byte without dependency symlinks or changes to the original private workspace.

Production browser interaction and deployment verification are separate release gates. See `qa/PUBLIC-VALIDATION.md` for current status. This edition does not claim a deployed public URL until that URL is separately published and checked.
