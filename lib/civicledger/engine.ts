import type {Doc,SourceRef,Fixture,Evidence,Packet,Claim,Finding} from './types.ts';
import {checklist} from './fixtures.ts';
export async function hash(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(JSON.stringify(value));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export const money=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(c/100);
export function parseCents(raw:string):number|null {if(!/^\d{1,3}(?:,\d{3})*\.\d{2}$|^\d+\.\d{2}$/.test(raw))return null; const [i,d]=raw.replaceAll(',','').split('.'); const n=Number(i)*100+Number(d);return Number.isSafeInteger(n)?n:null;}
async function ref(doc:Doc,start:number,end=start):Promise<SourceRef>{return {docId:doc.id,caseId:doc.caseId,version:doc.version,hash:await hash(doc),page:1,start,end,excerpt:doc.lines!.slice(start-1,end).join('\n')};}
export async function validateRef(r:SourceRef,docs:Doc[],caseId:string):Promise<boolean>{const matches=docs.filter(x=>x.id===r.docId);
// A citation must identify exactly one source, even when duplicate contents match.
if(matches.length!==1)return false;
const d=matches[0];return !!d?.lines && d.caseId===caseId && r.caseId===caseId && r.version===d.version && r.hash===await hash(d) && r.page===1 && Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=1&&r.end>=r.start&&r.end<=d.lines.length&&r.excerpt===d.lines.slice(r.start-1,r.end).join('\n');}
async function extract(doc:Doc):Promise<Evidence>{
const lines=doc.lines||[]; const rawLine=lines.findIndex(s=>/^(?:Total )?[Gg]ross employment income for this period:|^Total net employment income for this period:/.test(s));
const raw=rawLine>=0?lines[rawLine].match(/: ([\d,.]+)\.$/)?.[1]??null:null;
const personLine=lines.findIndex(s=>/^(Applicant|Employee): /.test(s));
const empLine=lines.findIndex(s=>s.startsWith('Employment: ')||s.includes('. Employer: '));
const periodLine=lines.findIndex(s=>s.startsWith('Income period: '));
const person=lines[personLine]?.match(/^(?:Applicant|Employee): ([^.]+)\./)?.[1]??null;
const employer=lines[empLine]?.match(/(?:^Employment: |\. Employer: )([^.]+)\./)?.[1]??null;
const period=lines[periodLine]?.match(/^Income period: ([^.]+)\./)?.[1]??null;
const currency=lines[periodLine]?.match(/Currency: ([A-Z]{3})\./)?.[1]??null;
const basis=rawLine>=0?lines[rawLine].toLowerCase().match(/(gross|net) employment/)?.[1]??null:null;
const amountCents=raw?parseCents(raw):null;
const refs=await Promise.all([...new Set([personLine,empLine,periodLine,rawLine])].filter(i=>i>=0).map(i=>ref(doc,i+1)));
return {docId:doc.id,raw,amountCents,person,employer,period,currency,basis,status:[raw,person,employer,period,currency,basis,amountCents].some(x=>x===null)?'UNKNOWN':'EXTRACTED',refs};
}
const neutral=['Could you clarify the difference and provide the September pay statement requested for this demonstration?','Could you clarify the difference between these records?','Please provide the September pay statement requested for this demonstration.','If you cannot provide it, please let the caseworker know so they can review the next step.','Please review these records with the caseworker.','Thank you for reviewing this information.'];
export function validateDraft(text:string,packet:Packet):string[]{
if(!text.trim())return ['The draft is empty.'];
if(text.length>5000)return ['The draft exceeds the 5,000-character demo limit.'];
const sentences=text.trim().split(/(?<=[.!?])\s+(?=[A-Z])/).map(x=>x.trim()).filter(Boolean);
const allowed=new Set(packet.allowedSentences);
const unsupported=sentences.filter(s=>!allowed.has(s));
return unsupported.length?['This deterministic demo cannot verify one or more edited sentences. Use the source-grounded suggested text or verified wording below. The edit is retained, but acceptance is blocked.']:[];
}
export async function processFixture(f:Fixture):Promise<Packet>{
const started=performance.now();
const manifest:Doc={id:'M01',title:'Submitted packet manifest',caseId:f.caseId,version:1,lines:f.manifest?[`Case: ${f.caseId}.`,`Manifest complete: ${f.manifest.complete?'yes':'no'}.`,`Submitted items: ${f.manifest.submitted.join(', ')}.`,`D03 is the reserved September 2026 pay statement ID.`]:null};
const docs=[...structuredClone(f.docs),manifest,{...structuredClone(checklist),caseId:f.caseId}];
const p:Packet={caseId:f.caseId,fixtureId:f.id,sourceHash:await hash({docs,manifest:f.manifest}),docs,evidence:[],findings:[],claims:[],suggestedDraft:'',allowedSentences:[],draftRefs:[],status:'DRAFT_READY',stages:[{name:'Manifest',status:'passed'},{name:'Extraction',status:'passed'},{name:'Checks',status:'passed'},{name:'Source verification',status:'passed'},{name:'Draft',status:'passed'}],versions:{fixture:'1',checklist:'DEMO-CHECKLIST-v1',engine:'deterministic-1.0.0',model:'none',prompt:'template-v1'},metrics:{durationMs:0,modelCalls:0,tokens:0},diagnostics:[]};
function incomplete(title:string,rationale:string){p.findings.push({id:'F'+(p.findings.length+1),type:'incomplete',ruleId:'INPUT',title,rationale,refs:[]});p.status='NEEDS_REVIEW';}
const readable=!!f.manifest?.complete&&f.manifest.submitted.length===f.docs.length&&new Set(f.manifest.submitted).size===f.docs.length&&f.manifest.submitted.every(id=>f.docs.some(d=>d.id===id));
if(!readable){incomplete('Packet completeness is unknown','A complete, readable manifest is required before declaring a document absent.');p.stages[0].status='blocked';}
if(f.docs.some(d=>d.caseId!==f.caseId)){incomplete('Case scope does not match','A source belongs to a different case. It was not processed.');p.stages[1].status='blocked';}
else {for(const d of f.docs.filter(d=>['D01','D02'].includes(d.id))){if(!d.lines){incomplete(`${d.id} is unreadable`,'The affected extraction and checks are incomplete. A corrected source is required.');p.stages[1].status='blocked';}else{const e=await extract(d);p.evidence.push(e);if(e.status==='UNKNOWN'){incomplete(`${d.id} has an unknown field`,'Income, person, employer, currency, basis and period must all be readable.');p.stages[1].status='blocked';}}}}
for(const d of f.docs.filter(d=>!['D01','D02'].includes(d.id)&&!d.lines)){incomplete(`${d.id} is unreadable`,'The submitted source cannot be read. Its affected checks remain incomplete.');p.stages[1].status='blocked';}
const a=p.evidence.find(e=>e.docId==='D01'),b=p.evidence.find(e=>e.docId==='D02');
if(readable && !f.manifest!.submitted.includes('D01')) incomplete('Intake record is absent','R01 expects the intake record; the complete packet does not include it.');
// Conservative: unreadable input pauses completeness findings rather than suggesting a finished check.
if(readable && p.stages[1].status==='passed' && !f.manifest!.submitted.includes('D03'))p.findings.push({id:'MISSING-D03',type:'missing',ruleId:'R02',title:'September pay statement missing',rationale:'D03 is absent from this complete submitted packet. This is a synthetic checklist request, not a policy violation.',missingExpectedDocId:'D03',refs:[await ref(manifest,2,4),await ref(docs[docs.length-1],2)]});
if(a?.status==='EXTRACTED' && b?.status==='EXTRACTED'){
const keys=['person','employer','currency','basis','period'] as const; const mismatch=keys.filter(k=>a[k]!==b[k]);
if(mismatch.length)p.findings.push({id:'CONTEXT-MISMATCH',type:'not_comparable',ruleId:'R03',title:'Income values are not comparable',rationale:`Different ${mismatch.join(', ')}. No income difference is calculated.`,refs:[...a.refs,...b.refs,await ref(docs[docs.length-1],3)]});
else if(a.amountCents!==b.amountCents)p.findings.push({id:'INCOME-CONFLICT',type:'conflict',ruleId:'R04',title:'September income needs clarification',rationale:`The two records differ by ${money(Math.abs(a.amountCents!-b.amountCents!))}. Both values remain unresolved; neither is selected as correct.`,values:[a.amountCents!,b.amountCents!],differenceCents:Math.abs(a.amountCents!-b.amountCents!),refs:[...a.refs,...b.refs,await ref(docs[docs.length-1],3,4)]});
}
for(const e of p.evidence.filter(e=>e.status==='EXTRACTED'))p.claims.push({text:`${e.docId} reports ${e.currency} ${money(e.amountCents!)} in ${e.basis} employment income for ${e.person} at ${e.employer}, ${e.period}.`,refs:e.refs});
for(const item of [...p.claims,...p.findings])for(const r of item.refs)if(!await validateRef(r,docs,f.caseId)){incomplete('Source verification failed','A claim or finding did not match the original source.');p.stages[3].status='blocked';}
if(p.status==='DRAFT_READY'){
const facts=p.claims.map(c=>c.text); const conflict=p.findings.some(x=>x.type==='conflict'),missing=p.findings.some(x=>x.type==='missing'),mismatch=p.findings.some(x=>x.type==='not_comparable');
const ask=conflict&&missing?neutral[0]:conflict?neutral[1]:missing?neutral[2]:neutral[4];
let closing=missing?neutral[3]:neutral[5];
if(mismatch) closing='Please review these records with the caseworker.';
p.allowedSentences=[...facts,ask,closing,neutral[4],neutral[5],...(missing?[neutral[2],neutral[3]]:[]),...(conflict?[neutral[1]]:[])];
p.suggestedDraft=[...facts,ask,closing].join('\n\n');p.draftRefs=[...p.claims.flatMap(c=>c.refs),...p.findings.flatMap(x=>x.refs)];
if(validateDraft(p.suggestedDraft,p).length){p.status='FAILED';p.diagnostics.push('Generated draft did not pass deterministic sentence verification.');}
}else{p.stages[2].status='blocked';p.stages[3].status='blocked';p.stages[4].status='blocked';}
p.metrics.durationMs=Math.round((performance.now()-started)*100)/100;return p;
}
