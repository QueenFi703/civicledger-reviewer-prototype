import { getFixture } from './fixtures.ts';
import { hash, processFixture, validateRef } from './engine.ts';
import type { Claim, Doc, SourceRef } from './types.ts';

export const astraTopics = [
  { id: 'financial', label: 'Explain financial records', question: 'What do the financial records say, and what needs clarification?' },
  { id: 'support', label: 'Understand support needs', question: 'What medical-access support has this person asked for?' },
  { id: 'resources', label: 'Explore public resources', question: 'Where could a caseworker start general resource research?' },
  { id: 'questions', label: 'Prepare review questions', question: 'What should I clarify with this person before taking a next step?' },
] as const;
export type AstraTopic = typeof astraTopics[number]['id'];

// Fixed links only: no case attributes, identifiers, searches, or URL parameters.
export const publicResources = [
  { title: 'Government benefits directory', agency: 'USA.gov', url: 'https://www.usa.gov/benefits', description: 'Official starting points for food, housing, health coverage, and basic living expenses.', review: 'Confirm the jurisdiction and current program rules with the responsible agency.' },
  { title: 'Find a Health Center', agency: 'HRSA', url: 'https://findahealthcenter.hrsa.gov/', description: 'Official health center locator for a caseworker to explore with the person.', review: 'Confirm local availability, accessibility, and costs directly with the center.' },
  { title: 'Help with drug costs', agency: 'Medicare.gov', url: 'https://www.medicare.gov/basics/costs/help/drug-costs', description: 'General information about help with Medicare prescription drug costs.', review: 'Medicare coverage is unknown in this case. This is not a finding that the person qualifies.' },
] as const;

export type AstraPreview = {
  mode: 'sample'; modelCalls: 0; reviewStatus: 'unreviewed';
  caseId: string; fixtureId: string; sourceHash: string; topic: AstraTopic;
  docs: Doc[]; facts: Claim[]; observations: Claim[];
  missing: string[]; questions: string[]; boundary: string;
};

export function supportDocument(fixtureId: string): Doc {
  const fixture = getFixture(fixtureId);
  const name = fixtureId === 'name' ? 'Taylor Reed' : 'Jordan Vale';
  return { id: 'ASTRA-S01', title: 'Fictional support-needs conversation', caseId: fixture.caseId, version: 1, lines: [
    `Case ${fixture.caseId}. ${name}. Synthetic preview supplement dated 3 October 2026.`,
    'Self-report: I would like help finding transportation to routine medical appointments.',
    'Self-report: I would like to understand options for help with prescription costs.',
    'No diagnosis, prescription list, clinical assessment, insurance verification, or consent record is included.',
    'Service area is fictional. Transport availability, costs, and time sensitivity have not been established.',
    'Authored for this preview only. Not an uploaded record or part of the temporary evidence-review packet.',
  ] };
}

async function sourceRef(doc: Doc, line: number): Promise<SourceRef> {
  return { docId: doc.id, caseId: doc.caseId, version: doc.version, hash: await hash(doc), page: 1, start: line, end: line, excerpt: doc.lines![line - 1] };
}

/** A local deterministic illustration. No network, secrets, database writes or model calls. */
export async function buildAstraPreview(fixtureId: string, topic: AstraTopic, signal?: AbortSignal): Promise<AstraPreview> {
  signal?.throwIfAborted();
  if (!astraTopics.some(t => t.id === topic)) throw new Error('Choose one of the fictional preview questions.');
  const packet = await processFixture(getFixture(fixtureId));
  const supplement = supportDocument(fixtureId);
  const docs = [...packet.docs, supplement];
  const includesFinance = topic === 'financial' || topic === 'questions';
  const includesSupport = topic === 'support' || topic === 'questions';
  const facts: Claim[] = includesFinance ? [...packet.claims] : [];
  if (includesSupport) {
    facts.push({ text: 'The fictional conversation records a request for help finding transportation to routine medical appointments. This is a self-report.', refs: [await sourceRef(supplement, 2)] });
    facts.push({ text: 'The fictional conversation records a request to understand prescription-cost support options. Costs and coverage are unverified.', refs: [await sourceRef(supplement, 3)] });
  }
  const observations: Claim[] = includesFinance ? packet.findings.filter(f => f.refs.length > 0).map(f => ({ text: `${f.title}. ${f.rationale}`, refs: f.refs })) : [];
  const missing: string[] = [];
  const questions: string[] = [];
  if (includesFinance) {
    if (packet.status !== 'DRAFT_READY') missing.push('Evidence checks are incomplete. An unreadable record or incomplete manifest prevents a complete financial explanation. Review the Evidence & findings tab.');
    if (packet.findings.some(f => f.type === 'missing')) missing.push('The September pay statement is absent from the complete fictional packet. Its contents are unknown.');
    if (packet.findings.some(f => f.type === 'conflict')) questions.push('Could you clarify the difference between the two reported income amounts? Neither record is treated as correct.');
    if (packet.findings.some(f => f.type === 'not_comparable')) questions.push('Could we confirm matching income periods and gross or net basis before comparing these amounts?');
    questions.push('What current expenses or payment concerns would you like help understanding? The packet does not establish an available balance or financial plan.');
    missing.push('Current bank balances, living expenses, debts, and authorized payee arrangements are not established by these records.');
  }
  if (includesSupport) {
    missing.push('No clinical records are included. Diagnosis, treatment, medications, coverage, appointment details, and urgency cannot be inferred.');
    missing.push('Consent and authority to obtain health records are not established. No records are requested by this preview.');
    questions.push('Which transport or prescription-cost concern would you like the caseworker to help explore first?');
    questions.push('What assistance would you like, and what information are you comfortable authorizing the caseworker to review?');
  }
  if (topic === 'resources') {
    missing.push('Location, program coverage, current availability, and suitability are unknown. These links are general reference material, not case evidence.');
    questions.push('Confirm the person’s service area and priorities before checking current official resources.');
  }
  for (const claim of [...facts, ...observations]) for (const ref of claim.refs) {
    if (!await validateRef(ref, docs, packet.caseId)) throw new Error('A sample source could not be verified. No response is shown.');
  }
  const sourceHash = await hash({ fixtureId, docs });
  signal?.throwIfAborted();
  return { mode: 'sample', modelCalls: 0, reviewStatus: 'unreviewed', caseId: packet.caseId, fixtureId, sourceHash, topic, docs, facts, observations, missing, questions,
    boundary: 'Caseworker review required. No eligibility, benefit amount, fraud, diagnosis, treatment, or financial decision is made. Questions are discussion prompts, not findings.' };
}

/** Late responses never replace a newer question or a dismissed/changed case. */
export class PreviewRequestGate {
  private generation = 0;
  begin() { return ++this.generation; }
  cancel() { this.generation++; }
  isCurrent(token: number) { return token === this.generation; }
}
