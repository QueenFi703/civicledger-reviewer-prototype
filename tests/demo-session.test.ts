import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoSession, DEMO_LIMITS, type DemoActionInput } from '../src/demo-session.ts';
import { fixtureCatalog } from '../lib/civicledger/fixtures.ts';
import { validateRef } from '../lib/civicledger/engine.ts';
import type { Run } from '../lib/civicledger/types.ts';
const input = (r: Run, changes: Partial<DemoActionInput> = {}): DemoActionInput => ({ action: 'edit', caseId: r.packet.caseId, sourceHash: r.packet.sourceHash, revision: r.revision, draftVersion: r.draftVersion, requestId: crypto.randomUUID(), draftText: r.draftText, reason: '', ...changes });

test('every known fixture runs; unknown fixtures fail', async () => {
  const s = new DemoSession();
  for (const f of fixtureCatalog) assert.equal((await s.start(f.id)).packet.fixtureId, f.id);
  await assert.rejects(s.start('not-a-fixture'), /known fictional/);
  assert.equal(s.list().length, 9);
});
test('independent sessions and returned objects cannot share or mutate state', async () => {
  const a = new DemoSession(), b = new DemoSession(), r = await a.start('seeded');
  assert.throws(() => b.get(r.id), /unavailable/);
  r.packet.docs[0].lines![0] = 'tampered'; r.packet.draftRefs[0].excerpt = 'tampered'; r.events.push({} as never);
  assert.notEqual(a.get(r.id).packet.docs[0].lines![0], 'tampered');
  assert.notEqual(a.get(r.id).packet.draftRefs[0].excerpt, 'tampered');
  const listed = a.list(); listed[0].status = 'tampered'; assert.notEqual(a.list()[0].status, 'tampered');
  assert.equal(a.get(r.id).events.length, 0);
  a.reset(); assert.equal(a.list().length, 0); assert.throws(() => a.get(r.id), /unavailable/);
});
test('accept requires explicit acknowledgment and retains unresolved findings', async () => {
  const s = new DemoSession(), r = await s.start('seeded');
  await assert.rejects(s.act(r.id, input(r, { action: 'accept' })), /acknowledge/);
  const accepted = await s.act(r.id, input(r, { action: 'accept', acknowledged: true, reason: 'Fictional review' }));
  assert.equal(accepted.status, 'REVIEWED_DRAFT'); assert.equal(accepted.packet.findings.length, 2);
  assert.equal(accepted.reviewerNote, 'Fictional review');
  await assert.rejects(s.act(r.id, input(accepted, { action: 'reject', reason: 'Again' })), /already/);
  const edited = await s.act(r.id, input(accepted)); assert.equal(edited.status, 'DRAFT_READY');
  assert.equal(edited.draftVersion, 2); assert.equal(edited.events.length, 2);
});
test('unsupported edits block acceptance but can be rejected with a note', async () => {
  const s = new DemoSession(), r = await s.start('seeded');
  const edited = await s.act(r.id, input(r, { draftText: 'Guaranteed benefits approval.' }));
  assert.equal(edited.status, 'NEEDS_REVIEW'); assert.ok(edited.groundingErrors.length);
  await assert.rejects(s.act(r.id, input(edited, { action: 'accept', acknowledged: true })), /unverified/);
  await assert.rejects(s.act(r.id, input(edited, { action: 'reject', reason: ' ' })), /reason/);
  assert.equal((await s.act(r.id, input(edited, { action: 'reject', reason: 'Unsupported claim' }))).status, 'REJECTED_DRAFT');
});
test('incomplete evidence stays blocked even after neutral edits; rejection is allowed', async () => {
  for (const f of ['manifest', 'partial', 'unreadable']) {
    const s = new DemoSession(), r = await s.start(f);
    const edited = await s.act(r.id, input(r, { draftText: 'Thank you for reviewing this information.' }));
    await assert.rejects(s.act(r.id, input(edited, { action: 'accept', acknowledged: true })), /Incomplete/);
    assert.equal((await s.act(r.id, input(edited, { action: 'reject', reason: 'Incomplete evidence' }))).status, 'REJECTED_DRAFT');
  }
});
test('strict source/case/version and saved-text guards', async () => {
  const s = new DemoSession(), r = await s.start('seeded');
  for (const fields of [{ sourceHash: '0'.repeat(64) }, { caseId: 'other' }, { revision: 2 }, { draftVersion: 2 }]) await assert.rejects(s.act(r.id, input(r, fields)), /changed/);
  await assert.rejects(s.act(r.id, input(r, { action: 'accept', acknowledged: true, draftText: 'Unsaved' })), /Save draft/);
  const edited = await s.act(r.id, input(r));
  await assert.rejects(s.act(r.id, input(r)), /changed/); assert.equal(edited.revision, 2);
});
test('replay succeeds only for the exact normalized payload and run', async () => {
  const s = new DemoSession(), r = await s.start('seeded'), request = input(r);
  const first = await s.act(r.id, request); const replay = await s.act(r.id, request);
  assert.deepEqual(first, replay); assert.equal(s.get(r.id).events.length, 1);
  for (const fields of [{ reason: 'different' }, { acknowledged: false }, { revision: 2 }]) await assert.rejects(s.act(r.id, { ...request, ...fields }), /different payload/);
  const other = await s.start('clean'); await assert.rejects(s.act(other.id, input(other, { requestId: request.requestId })), /different payload/);
});
test('concurrent changes do not overwrite; exact concurrent replay commits once', async () => {
  const s = new DemoSession(), r = await s.start('seeded');
  const results = await Promise.allSettled([s.act(r.id, input(r, { action: 'accept', acknowledged: true })), s.act(r.id, input(r, { reason: 'edit wins' }))]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(s.get(r.id).events.length, 1);
  const current = s.get(r.id), same = input(current);
  const copies = await Promise.all([s.act(r.id, same), s.act(r.id, same)]);
  assert.deepEqual(copies[0], copies[1]); assert.equal(s.get(r.id).events.length, 2);
});
test('reset invalidates in-flight start and mutation and permits fresh starts', async () => {
  const s = new DemoSession(); const pending = s.start('seeded'); s.reset();
  await assert.rejects(pending, /reset/); assert.equal(s.list().length, 0);
  const r = await s.start('seeded'), action = s.act(r.id, input(r, { action: 'accept', acknowledged: true })); s.reset();
  await assert.rejects(action, /reset/); assert.equal(s.list().length, 0);
  assert.equal((await s.start('clean')).revision, 1);
});
test('exact references reject tampered span, hash, case, version, page and duplicate docs', async () => {
  const s = new DemoSession(), r = await s.start('seeded'), ref = r.packet.draftRefs[0];
  assert.equal(await validateRef(ref, r.packet.docs, r.packet.caseId), true);
  for (const patch of [{ excerpt: 'tamper' }, { hash: '0'.repeat(64) }, { caseId: 'OTHER' }, { version: 2 }, { page: 2 }, { start: 0 }, { end: 999 }]) assert.equal(await validateRef({ ...ref, ...patch }, r.packet.docs, r.packet.caseId), false);
  assert.equal(await validateRef(ref, [...r.packet.docs, r.packet.docs.find(d => d.id === ref.docId)!], r.packet.caseId), false);
  // Returned references are clones: tampering cannot alter internal acceptance evidence.
  ref.excerpt = 'tamper'; assert.equal((await s.act(r.id, input(r, { action: 'accept', acknowledged: true }))).status, 'REVIEWED_DRAFT');
});
test('all input types and text bounds are enforced without state changes', async () => {
  const s = new DemoSession(), r = await s.start('seeded');
  const bad = [null, [], { ...input(r), action: 'approve' }, { ...input(r), reason: 4 }, { ...input(r), draftText: 'x'.repeat(5001) }, { ...input(r), reason: 'x'.repeat(1501) }, { ...input(r), revision: 1.5 }, { ...input(r), draftVersion: 0 }, { ...input(r), requestId: 'short' }, { ...input(r), requestId: 'x'.repeat(81) }, { ...input(r), acknowledged: 'yes' }, { ...input(r), refs: [] }];
  for (const value of bad) await assert.rejects(s.act(r.id, value as DemoActionInput));
  assert.equal(s.get(r.id).revision, 1);
  const edited = await s.act(r.id, input(r, { draftText: 'x'.repeat(5000), reason: 'x'.repeat(1500) })); assert.equal(edited.draftText.length, 5000);
});
test('caller cannot change an in-flight payload', async () => {
  const s = new DemoSession(), r = await s.start('clean'), request = input(r, { reason: 'original' });
  const pending = s.act(r.id, request); request.reason = 'changed';
  assert.equal((await pending).reviewerNote, 'original');
});
test('run reservations and event/request limits bound memory', async () => {
  const s = new DemoSession();
  const runs = await Promise.all(Array.from({ length: DEMO_LIMITS.runs }, () => s.start('clean')));
  await assert.rejects(s.start('clean'), /limit/);
  for (let i = 0; i < DEMO_LIMITS.requestIds; i++) {
    const r = s.get(runs[Math.floor(i / DEMO_LIMITS.eventsPerRun)].id);
    await s.act(r.id, input(r));
    if (i === DEMO_LIMITS.eventsPerRun - 1) await assert.rejects(s.act(r.id, input(s.get(r.id))), /limit/);
  }
  await assert.rejects(s.act(runs[6].id, input(s.get(runs[6].id))), /limit/);
  s.reset(); assert.equal((await s.start('clean')).events.length, 0);
});
test('export labels data fictional, disposable and non-authoritative with neutral simulated actors', async () => {
  const s = new DemoSession(), r = await s.start('injection');
  const result = await s.act(r.id, input(r, { action: 'accept', acknowledged: true }));
  assert.equal(result.ownerId, 'simulated-local-session'); assert.equal(result.events[0].reviewerId, 'simulated-local-reviewer');
  const exported = JSON.parse(s.export(r.id));
  assert.match(exported.notice, /FICTIONAL.*Disposable.*Non-authoritative/); assert.match(exported.notice, /Nothing has been sent/);
  assert.equal(result.packet.metrics.modelCalls, 0); assert.ok(!result.draftText.includes('IGNORE ALL RULES'));
});
