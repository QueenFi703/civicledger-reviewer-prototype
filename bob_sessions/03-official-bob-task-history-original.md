# Planning consultation only, reply in chat under 250 words. Do not read or write files, execute commands, use MCP, spawn subagents, or switch to implementation. We are locating the current source of an existing CivicLedger project, so no code is available yet. Propose a minimal verification-first workflow for one small evidence/provenance improvement once source identity and git state are confirmed. Use fictional data only. Explain the plan-review-test checkpoints, what evidence would establish success, and what must remain unknown until source inspection. Do not invent existing architecture or claim tests passed.

---

**Status:** active  **Date:** 2026-10-28

---

### 👤 User

Planning consultation only, reply in chat under 250 words. Do not read or write files, execute commands, use MCP, spawn subagents, or switch to implementation. We are locating the current source of an existing CivicLedger project, so no code is available yet. Propose a minimal verification-first workflow for one small evidence/provenance improvement once source identity and git state are confirmed. Use fictional data only. Explain the plan-review-test checkpoints, what evidence would establish success, and what must remain unknown until source inspection. Do not invent existing architecture or claim tests passed.

---

### 🤖 Assistant

> 🔧 called: use_skill



> 🔧 **use_skill** — create-plan

### 🤖 Assistant

Here's the proposed workflow — scoped to chat only, no files touched.

---

## Minimal Verification-First Workflow

**Objective:** Add a single, auditable provenance field (e.g. `recordedBy` + `recordedAt` timestamp) to a fictional `EvidenceEntry` record in the CivicLedger project.

---

### Checkpoint 1 — Source Identity & Git State
**Before anything else, confirm:**
- Which repository and branch is the authoritative source
- Whether there are uncommitted local changes that could confuse baseline readings
- The language/framework in use (e.g. TypeScript/Node, Java, Python)

**Must remain unknown until inspection:** existing field names, DB schema, test harness, and any current provenance handling.

---

### Checkpoint 2 — Plan Review
Once source is inspected, a single-sub-task plan is written:
- Add `recordedBy: string` and `recordedAt: ISO8601` to `EvidenceEntry`
- Propagate through one write path only
- No unrelated refactors

**Review gate:** a human confirms the diff scope matches exactly the plan before any code is merged.

---

### Checkpoint 3 — Test Evidence for Success
Success is established when:
1. A unit test asserts that a saved `EvidenceEntry` carries non-null `recordedBy` and `recordedAt` values
2. A read-back of the fictional record (e.g. `entry#CIVIC-042`) returns those fields unchanged
3. No existing tests regress

---

### What Stays Unknown Until Inspection
- Whether a provenance abstraction already exists
- Whether schema migrations are managed by a tool
- Whether the write path is synchronous or event-driven

---

### 👤 User

Verified current CivicLedger v4 source; existing engine suite 16/16 passes. Review only the existing validator below. No new architecture/schema/integration/hook; no file/command/MCP/subagent actions. Give a minimal repair plan and replacement first lines in chat, not file edits. Candidate bug: .find selects first document with matching ID, so duplicate IDs can make exact source identity ambiguous. Should reject any duplicate matching ID, including identical duplicates, independent of order. Preserve every existing check. Suggest regression cases using existing node:test, assert, getFixture('seeded'), processFixture and validateRef; fictional data only. Existing function: export async function validateRef(r:SourceRef,docs:Doc[],caseId:string):Promise<boolean>{const d=docs.find(x=>x.id===r.docId);return !!d?.lines && d.caseId===caseId && r.caseId===caseId && r.version===d.version && r.hash===await hash(d) && r.page===1 && Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=1&&r.end>=r.start&&r.end<=d.lines.length&&r.excerpt===d.lines.slice(r.start-1,r.end).join('\n');} Explain limitations, do not claim tests ran.

---

### 🤖 Assistant

## Minimal Repair Plan

### The Bug

[`docs.find()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find) silently picks the **first** matching document when duplicates exist. A duplicate `docId` makes source identity ambiguous — the validator could pass or fail depending purely on array order, which is non-deterministic in practice.

**Required behaviour:** if more than one `Doc` shares `r.docId`, reject immediately — regardless of whether the duplicates are identical or divergent.

---

### Repair: Replacement First Lines

Replace the single `.find()` with a duplicate-guard before any other check:

```ts
export async function validateRef(r: SourceRef, docs: Doc[], caseId: string): Promise<boolean> {
  const matches = docs.filter(x => x.id === r.docId);
  if (matches.length !== 1) return false;        // 0 = missing, 2+ = ambiguous
  const d = matches[0];
  // ... all existing checks unchanged below this line ...
```

Every existing check (`lines`, `caseId`, `version`, `hash`, `page`, `start`, `end`, `excerpt`) is preserved verbatim after line 3.

---

### Limitations of the Existing Function

- **Hash collision:** two physically different documents could share the same `hash` value — the validator would pass for the wrong document.
- **No ordering guarantee:** `docs` array order is caller-controlled; callers could shuffle to influence which duplicate wins.
- **`r.page === 1` is hardcoded** — multi-page documents are structurally rejected without explanation.
- **No null-guard on `r` fields** — a malformed `SourceRef` with `undefined` fields passes integer checks vacuously in some JS runtimes.

---

### Suggested Regression Cases

Using `node:test`, `assert`, `getFixture('seeded')`, `processFixture`, and `validateRef` — fictional data only:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Case 1 — identical duplicate IDs must reject (was: order-dependent pass)
test('rejects identical duplicate docId', async () => {
  const base = await getFixture('seeded');       // returns Doc[]
  const doc  = processFixture(base, 'DOC-101');  // single valid Doc
  const ref  = buildRef(doc);                    // valid SourceRef
  const withDupe = [doc, { ...doc }];            // two identical entries
  assert.strictEqual(await validateRef(ref, withDupe, 'CASE-77'), false);
});

// Case 2 — divergent duplicate IDs must also reject
test('rejects divergent duplicate docId', async () => {
  const base  = await getFixture('seeded');
  const doc1  = processFixture(base, 'DOC-101');
  const doc2  = processFixture(base, 'DOC-101', { version: 2 }); // same id, diff version
  const ref   = buildRef(doc1);
  assert.strictEqual(await validateRef(ref, [doc1, doc2], 'CASE-77'), false);
});

// Case 3 — single valid doc still passes (regression guard)
test('accepts unique docId', async () => {
  const base = await getFixture('seeded');
  const doc  = processFixture(base, 'DOC-101');
  const ref  = buildRef(doc);
  assert.strictEqual(await validateRef(ref, [doc], 'CASE-77'), true);
});

// Case 4 — empty docs array rejects cleanly
test('rejects missing docId', async () => {
  const base = await getFixture('seeded');
  const doc  = processFixture(base, 'DOC-101');
  const ref  = buildRef(doc);
  assert.strictEqual(await validateRef(ref, [], 'CASE-77'), false);
});
```

**Note:** `buildRef` is a local test helper that constructs a valid `SourceRef` from a `Doc` — not part of the production API. These cases are illustrative; no tests have been run against the actual suite.