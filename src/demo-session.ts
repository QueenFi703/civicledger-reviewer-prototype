import type { Run, SourceRef } from '../lib/civicledger/types.ts';
import { getFixture, fixtureCatalog } from '../lib/civicledger/fixtures.ts';
import { hash, processFixture, validateDraft, validateRef } from '../lib/civicledger/engine.ts';

export const DEMO_LIMITS = Object.freeze({ runs: 12, eventsPerRun: 100, requestIds: 600, draftCharacters: 5000, noteCharacters: 1500 });
export type DemoActionInput = {
  action: 'edit' | 'accept' | 'reject'; caseId: string; sourceHash: string;
  draftVersion: number; revision: number; requestId: string;
  draftText: string; reason: string; acknowledged?: boolean;
};
export class DemoSessionError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.name = 'DemoSessionError'; this.status = status; }
}
const fail = (status: number, message: string): never => { throw new DemoSessionError(status, message); };
const clone = <T>(value: T): T => structuredClone(value);

/** Disposable fictional state only. No authenticated identity or durable audit guarantees. */
export class DemoSession {
  #runs = new Map<string, Run>();
  #requests = new Map<string, { runId: string; payload: string }>();
  #generation = 0;
  #pendingStarts = 0;

  async start(fixtureId: string): Promise<Run> {
    if (typeof fixtureId !== 'string' || !fixtureCatalog.some(f => f.id === fixtureId)) fail(400, 'Choose a known fictional fixture.');
    if (this.#runs.size + this.#pendingStarts >= DEMO_LIMITS.runs) fail(409, 'Demo run limit reached. Reset Demo to start again.');
    const generation = this.#generation;
    this.#pendingStarts++;
    try {
      const packet = await processFixture(getFixture(fixtureId));
      this.#checkGeneration(generation);
      const now = new Date().toISOString();
      const run: Run = { id: crypto.randomUUID(), ownerId: 'simulated-local-session', revision: 1, draftVersion: 1,
        status: packet.status, packet, draftText: packet.suggestedDraft, reviewerNote: '', groundingErrors: [], events: [], createdAt: now, updatedAt: now };
      this.#runs.set(run.id, run);
      return clone(run);
    } finally { if (generation === this.#generation) this.#pendingStarts--; }
  }

  get(id: string): Run { return clone(this.#read(id)); }
  list(): { id: string; fixtureId: string; status: string; draftVersion: number; updatedAt: string }[] {
    return [...this.#runs.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(r => ({
      id: r.id, fixtureId: r.packet.fixtureId, status: r.status, draftVersion: r.draftVersion, updatedAt: r.updatedAt,
    }));
  }
  reset(): void { this.#generation++; this.#runs.clear(); this.#requests.clear(); this.#pendingStarts = 0; }

  async act(id: string, supplied: DemoActionInput): Promise<Run> {
    this.#validateInput(supplied);
    // Snapshot callers' objects before any asynchronous operation.
    const input = clone(supplied);
    const generation = this.#generation;
    const payload = JSON.stringify([input.action, input.caseId, input.sourceHash, input.draftVersion, input.revision, input.draftText, input.reason, input.acknowledged ?? null]);
    const r = this.#read(id);
    const replay = this.#replay(id, input.requestId, payload);
    if (replay) return replay;
    this.#guard(r, input);
    if (r.events.length >= DEMO_LIMITS.eventsPerRun || this.#requests.size >= DEMO_LIMITS.requestIds) fail(409, 'Demo review limit reached. Reset Demo to start again.');
    if (input.action !== 'edit') {
      if (input.draftText !== r.draftText) fail(409, 'Save draft changes before reviewing.');
      if (['REVIEWED_DRAFT', 'REJECTED_DRAFT'].includes(r.status)) fail(409, 'This version already has a simulated decision. Edit it to create a new version.');
      if (input.action === 'reject' && !input.reason.trim()) fail(400, 'Add a reason for rejecting this draft.');
    }
    if (input.action === 'accept') {
      if (input.acknowledged !== true) fail(400, 'Explicitly acknowledge this fictional, non-authoritative simulated review.');
      if (r.packet.status !== 'DRAFT_READY' || r.status !== 'DRAFT_READY' || r.packet.stages.some(s => s.status !== 'passed') || r.packet.findings.some(f => f.type === 'incomplete') || validateDraft(r.draftText, r.packet).length) fail(409, 'Incomplete evidence or unverified wording blocks acceptance.');
      const fixture = getFixture(r.packet.fixtureId);
      if (await hash({ docs: r.packet.docs, manifest: fixture.manifest }) !== r.packet.sourceHash) fail(409, 'The source set could not be verified.');
      const refs: SourceRef[] = [...r.packet.evidence.flatMap(e => e.refs), ...r.packet.claims.flatMap(c => c.refs), ...r.packet.findings.flatMap(f => f.refs), ...r.packet.draftRefs];
      if (!refs.length) fail(409, 'Verified source references are required.');
      for (const ref of refs) if (!await validateRef(ref, r.packet.docs, r.packet.caseId)) fail(409, 'An exact source reference could not be verified.');
    }
    const requestHash = await hash(payload);
    // Reset and concurrent edits/reviews can happen while Web Crypto is pending.
    this.#checkGeneration(generation);
    const concurrentReplay = this.#replay(id, input.requestId, payload);
    if (concurrentReplay) return concurrentReplay;
    const current = this.#read(id);
    this.#guard(current, input);
    if (current !== r) fail(409, 'This draft changed. Reload before reviewing.');
    if (current.events.length >= DEMO_LIMITS.eventsPerRun || this.#requests.size >= DEMO_LIMITS.requestIds) fail(409, 'Demo review limit reached. Reset Demo to start again.');
    const next = clone(current);
    const now = new Date().toISOString();
    if (input.action === 'edit') {
      next.draftVersion++;
      next.draftText = input.draftText;
      next.groundingErrors = validateDraft(next.draftText, next.packet);
      next.status = next.packet.status !== 'DRAFT_READY' ? next.packet.status : next.groundingErrors.length ? 'NEEDS_REVIEW' : 'DRAFT_READY';
    } else next.status = input.action === 'accept' ? 'REVIEWED_DRAFT' : 'REJECTED_DRAFT';
    next.reviewerNote = input.reason;
    next.events.push({ id: input.requestId, requestHash, reviewerId: 'simulated-local-reviewer', caseId: next.packet.caseId, runId: next.id,
      sourceHash: next.packet.sourceHash, draftVersion: next.draftVersion, action: input.action === 'edit' ? 'edited' : input.action === 'accept' ? 'accepted' : 'rejected',
      reason: input.reason, timestamp: now, text: next.draftText });
    next.revision++;
    next.updatedAt = now;
    this.#runs.set(id, next);
    this.#requests.set(input.requestId, { runId: id, payload });
    return clone(next);
  }

  export(id: string): string {
    const run = this.get(id);
    return JSON.stringify({ product: 'CivicLedger public reviewer prototype', notice: 'FICTIONAL DEMONSTRATION ONLY. Disposable, local, simulated review record. Non-authoritative: not an authenticated or durable audit trail, benefits decision, official policy, or sent communication. Nothing has been sent.',
      reviewerNoteLabel: 'Fictional-only human-authored note; not independently verified', run }, null, 2);
  }
  #read(id: string): Run { return this.#runs.get(id) ?? fail(404, 'This local demo run is unavailable.'); }
  #checkGeneration(generation: number): void { if (generation !== this.#generation) fail(409, 'Demo was reset. This operation was discarded.'); }
  #replay(id: string, requestId: string, payload: string): Run | null {
    const prior = this.#requests.get(requestId);
    if (!prior) return null;
    if (prior.runId !== id || prior.payload !== payload) fail(409, 'Request identifier was already used for a different payload.');
    return this.get(id);
  }
  #guard(run: Run, input: DemoActionInput): void {
    if (input.caseId !== run.packet.caseId || input.sourceHash !== run.packet.sourceHash) fail(409, 'The source set changed. Reload before reviewing.');
    if (input.revision !== run.revision || input.draftVersion !== run.draftVersion) fail(409, 'This draft changed. Reload before editing or reviewing.');
  }
  #validateInput(input: DemoActionInput): void {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'A review request object is required.');
    const allowed = ['action', 'caseId', 'sourceHash', 'draftVersion', 'revision', 'requestId', 'draftText', 'reason', 'acknowledged'];
    if (Object.keys(input).some(k => !allowed.includes(k))) fail(400, 'Unexpected review request field.');
    if (!['edit', 'accept', 'reject'].includes(input.action)) fail(400, 'Unsupported action.');
    if (typeof input.caseId !== 'string' || input.caseId.length > 80 || typeof input.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceHash)) fail(400, 'Valid case and source identifiers are required.');
    if (!Number.isSafeInteger(input.revision) || input.revision < 1 || !Number.isSafeInteger(input.draftVersion) || input.draftVersion < 1) fail(400, 'Positive integer versions are required.');
    if (typeof input.requestId !== 'string' || !/^[-\w]{8,80}$/.test(input.requestId)) fail(400, 'A valid request identifier is required.');
    if (typeof input.draftText !== 'string' || input.draftText.length > DEMO_LIMITS.draftCharacters) fail(400, 'Draft text must be at most 5,000 characters.');
    if (typeof input.reason !== 'string' || input.reason.length > DEMO_LIMITS.noteCharacters) fail(400, 'Reviewer note must be at most 1,500 characters.');
    if (input.acknowledged !== undefined && typeof input.acknowledged !== 'boolean') fail(400, 'Acknowledgment must be a boolean.');
  }
}
