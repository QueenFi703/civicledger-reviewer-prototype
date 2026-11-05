import test from 'node:test'; import assert from 'node:assert/strict';
import {getFixture,fixtureCatalog} from '../lib/civicledger/fixtures.ts';import {processFixture,validateRef,validateDraft,parseCents} from '../lib/civicledger/engine.ts';
test('seeded case yields exactly two grounded findings and $300 difference',async()=>{const p=await processFixture(getFixture('seeded'));assert.equal(p.status,'DRAFT_READY');assert.deepEqual(p.findings.map(x=>x.type),['missing','conflict']);assert.equal(p.findings[1].differenceCents,30000);assert.equal(p.evidence[0].amountCents,180000);assert.equal(p.evidence[1].amountCents,210000);assert.equal(p.metrics.modelCalls,0);assert.deepEqual(validateDraft(p.suggestedDraft,p),[]);for(const r of [...p.draftRefs,...p.findings.flatMap(x=>x.refs)])assert.ok(await validateRef(r,p.docs,p.caseId));assert.ok(!p.findings[0].refs.some(r=>r.docId==='D03'));});
test('clean control has no seeded warnings',async()=>{const p=await processFixture(getFixture('clean'));assert.equal(p.status,'DRAFT_READY');assert.deepEqual(p.findings,[]);});
for(const id of ['basis','period'])test(`${id}: noncomparable, no difference`,async()=>{const p=await processFixture(getFixture(id));assert.ok(p.findings.some(f=>f.type==='not_comparable'));assert.ok(!p.findings.some(f=>f.type==='conflict'||f.differenceCents!==undefined));});
for(const id of ['unreadable','manifest','partial'])test(`${id}: incomplete, no fabricated absence or ready draft`,async()=>{const p=await processFixture(getFixture(id));assert.equal(p.status,'NEEDS_REVIEW');assert.equal(p.suggestedDraft,'');assert.ok(!p.findings.some(f=>f.type==='missing'));});
test('document instructions are inert',async()=>{const p=await processFixture(getFixture('injection'));assert.equal(p.status,'DRAFT_READY');assert.equal(p.findings.length,2);assert.ok(!p.suggestedDraft.includes('SECRET'));assert.equal(p.metrics.modelCalls,0);});
test('equivalent name preserves findings',async()=>{const p=await processFixture(getFixture('name'));assert.deepEqual(p.findings.map(f=>f.type),['missing','conflict']);assert.ok(p.suggestedDraft.includes('Taylor Reed'));});
test('wrong case, fabricated citation, altered span and hash fail',async()=>{const p=await processFixture(getFixture('seeded'));const r=p.draftRefs[0];for(const patch of [{caseId:'OTHER'},{docId:'D03'},{excerpt:'made up'},{start:999},{hash:'bad'}])assert.equal(await validateRef({...r,...patch},p.docs,p.caseId),false);});
test('invalid numeric values stay unknown',async()=>{for(const v of ['NaN','1,80.00','-2.00','1.999'])assert.equal(parseCents(v),null);const f=getFixture('seeded');f.docs[0].lines![5]='Gross employment income for this period: unknown.';assert.equal((await processFixture(f)).status,'NEEDS_REVIEW');});
test('cross-case evidence is blocked',async()=>{const f=getFixture('seeded');f.docs[0].caseId='OTHER';assert.equal((await processFixture(f)).status,'NEEDS_REVIEW');});
test('unsupported edits including scope overreach block acceptance',async()=>{const p=await processFixture(getFixture('seeded'));for(const t of ['You are eligible for $500.','This is fraud.','D03 reports $100.','Your income is $3,000.'])assert.ok(validateDraft(t,p).length);assert.deepEqual(validateDraft(p.suggestedDraft+'\n\nThank you for reviewing this information.',p),[]);});
test('all bundled fixtures use fictional case-scoped documents',()=>{for(const m of fixtureCatalog){const f=getFixture(m.id);assert.equal(f.caseId,'DEMO-FA-001');assert.ok(f.docs.every(d=>d.caseId===f.caseId));}});
test('fractional source range is rejected',async()=>{const p=await processFixture(getFixture('seeded'));const r=p.draftRefs[0];assert.equal(await validateRef({...r,end:r.end+0.5},p.docs,p.caseId),false);});
test('unreadable supplied statement does not count as completed review',async()=>{const f=getFixture('clean');f.docs[2].lines=null;const p=await processFixture(f);assert.equal(p.status,'NEEDS_REVIEW');assert.equal(p.suggestedDraft,'');});

test('citation requires a unique document ID regardless of duplicate order',async()=>{
const p=await processFixture(getFixture('seeded'));const r=p.draftRefs[0];
const original=p.docs.find(d=>d.id===r.docId)!;
assert.equal(await validateRef(r,p.docs,p.caseId),true);
assert.equal(await validateRef(r,p.docs.filter(d=>d.id!==r.docId),p.caseId),false);
for(const duplicate of [structuredClone(original),{...structuredClone(original),lines:['Altered fictional source']}]){
for(const docs of [[duplicate,...p.docs],[...p.docs,duplicate]]){
assert.equal(await validateRef(r,docs,p.caseId),false,'duplicate source identity must fail closed');
}}
assert.equal(await validateRef(r,[...p.docs].reverse(),p.caseId),true);
const unrelated=p.docs.find(d=>d.id!==r.docId)!;
assert.equal(await validateRef(r,[...p.docs,structuredClone(unrelated)],p.caseId),true);
});

test('invalid finding citation blocks readiness and draft generation in either source order',async()=>{
for(const first of [true,false]){
const f=getFixture('seeded');
const collision={id:'M01',caseId:f.caseId,title:'Fictional colliding source',version:1,lines:['Unrelated fictional text']};
if(first)f.docs.unshift(collision);else f.docs.push(collision);
f.manifest!.submitted.push(collision.id);
const p=await processFixture(f);
assert.equal(p.status,'NEEDS_REVIEW');
assert.equal(p.stages.find(s=>s.name==='Source verification')!.status,'blocked');
assert.equal(p.stages.find(s=>s.name==='Draft')!.status,'blocked');
assert.equal(p.suggestedDraft,'');
assert.deepEqual(p.allowedSentences,[]);
assert.deepEqual(p.draftRefs,[]);
}
});
