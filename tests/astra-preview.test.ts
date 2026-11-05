import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAstraPreview, PreviewRequestGate, publicResources } from '../lib/civicledger/astra-preview.ts';
import { validateRef } from '../lib/civicledger/engine.ts';
import { fixtureCatalog } from '../lib/civicledger/fixtures.ts';

test('sample financial explanation preserves both values and exact sources', async () => {
  const result = await buildAstraPreview('seeded', 'financial');
  assert.equal(result.mode, 'sample');
  assert.equal(result.modelCalls, 0);
  assert.match(result.facts.map(f => f.text).join(' '), /1,800\.00/);
  assert.match(result.facts.map(f => f.text).join(' '), /2,100\.00/);
  assert.ok(result.observations.some(f => f.text.includes('$300.00')));
  for (const fact of [...result.facts, ...result.observations]) {
    assert.ok(fact.refs.length);
    for (const ref of fact.refs) assert.ok(await validateRef(ref, result.docs, result.caseId));
  }
  assert.equal(result.reviewStatus, 'unreviewed');
});

test('health-support facts are source-bound self-reports with no diagnosis or clinical conclusion', async () => {
  const result = await buildAstraPreview('seeded', 'support');
  assert.equal(result.facts.length, 2);
  assert.ok(result.facts.every(f => f.refs.every(r => r.docId === 'ASTRA-S01')));
  for (const fact of result.facts) for (const ref of fact.refs) assert.ok(await validateRef(ref, result.docs, result.caseId));
  assert.match(result.missing.join(' '), /No clinical records/);
  assert.match(result.boundary, /diagnosis/);
});

test('selected fixture changes remain bound to their actual records', async () => {
  const clean = await buildAstraPreview('clean', 'financial');
  const seeded = await buildAstraPreview('seeded', 'financial');
  assert.equal(clean.observations.length, 0);
  assert.notEqual(clean.sourceHash, seeded.sourceHash);
  const name = await buildAstraPreview('name', 'questions');
  assert.match(name.facts.map(f => f.text).join(' '), /Taylor Reed/);
  assert.doesNotMatch(name.facts.map(f => f.text).join(' '), /Jordan Vale/);
});

test('incomplete records stay unknown and untrusted source instructions remain inert', async () => {
  const unreadable = await buildAstraPreview('unreadable', 'financial');
  assert.ok(!unreadable.facts.some(f => f.text.includes('2,100.00')));
  assert.match(unreadable.missing.join(' '), /incomplete/);
  const injection = await buildAstraPreview('injection', 'questions');
  assert.doesNotMatch(JSON.stringify([...injection.facts, ...injection.observations, ...injection.questions]), /SECRET-002|example.invalid/);
});

test('public research remains separate, fixed, and free of case details in links', async () => {
  const result = await buildAstraPreview('seeded', 'resources');
  assert.equal(result.facts.length, 0);
  assert.equal(result.observations.length, 0);
  for (const resource of publicResources) {
    const url = new URL(resource.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.search, '');
    assert.ok(url.hostname.endsWith('.gov'));
  }
});

test('cancellation, repeated requests and source changes invalidate earlier results', () => {
  const gate = new PreviewRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.cancel();
  assert.equal(gate.isCurrent(second), false);
});

test('cancelled generation fails closed', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(buildAstraPreview('seeded', 'financial', controller.signal), { name: 'AbortError' });
});

test('cancellation during generation cannot deliver a completed sample', async () => {
  const controller = new AbortController();
  const pending = buildAstraPreview('seeded', 'questions', controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('every preset and fixture remains sample-only with valid scoped citations', async () => {
  for (const fixture of fixtureCatalog) for (const topic of ['financial', 'support', 'resources', 'questions'] as const) {
    const result = await buildAstraPreview(fixture.id, topic);
    assert.equal(result.fixtureId, fixture.id);
    assert.equal(result.reviewStatus, 'unreviewed');
    assert.equal(result.modelCalls, 0);
    for (const claim of [...result.facts, ...result.observations]) for (const ref of claim.refs) {
      assert.ok(await validateRef(ref, result.docs, result.caseId));
    }
  }
});
