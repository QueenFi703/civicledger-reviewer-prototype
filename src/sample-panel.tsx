import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronRight, CircleHelp, ExternalLink, FileText, HeartHandshake, LockKeyhole, MessageCircle, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { astraTopics, buildAstraPreview, PreviewRequestGate, publicResources, supportDocument } from '../lib/civicledger/astra-preview';
import type { AstraPreview, AstraTopic } from '../lib/civicledger/astra-preview';
import type { SourceRef } from '../lib/civicledger/types';
import { getFixture } from '../lib/civicledger/fixtures';

export default function SamplePanel({ fixtureId, onEvidence }: { fixtureId: string; onEvidence: () => void }) {
  const [topic, setTopic] = useState<AstraTopic>('financial');
  const [result, setResult] = useState<AstraPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedSource, setSelectedSource] = useState('D01');
  const [span, setSpan] = useState<SourceRef | null>(null);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const gate = useRef(new PreviewRequestGate());
  const controller = useRef<AbortController | null>(null);
  const sourceViewer = useRef<HTMLElement | null>(null);
  const fixture = getFixture(fixtureId);
  const docs = result?.docs ?? [...fixture.docs, supportDocument(fixtureId)];
  const doc = docs.find(d => d.id === selectedSource) ?? docs[0];

  useEffect(() => {
    const requestGate = gate.current;
    return () => { controller.current?.abort(); requestGate.cancel(); };
  }, []);

  function clear(message = '') {
    controller.current?.abort();
    gate.current.cancel();
    setBusy(false); setResult(null); setReviewed([]); setSpan(null); setError(''); setNotice(message);
  }

  async function showSample(nextTopic: AstraTopic = topic) {
    controller.current?.abort();
    const token = gate.current.begin();
    const nextController = new AbortController();
    controller.current = nextController;
    setTopic(nextTopic); setBusy(true); setResult(null); setReviewed([]); setSpan(null); setError(''); setNotice('');
    try {
      const sample = await buildAstraPreview(fixtureId, nextTopic, nextController.signal);
      if (!gate.current.isCurrent(token)) return;
      setResult(sample);
      setSelectedSource(nextTopic === 'support' ? 'ASTRA-S01' : 'D01');
    } catch (err) {
      if (gate.current.isCurrent(token) && !nextController.signal.aborted) setError(err instanceof Error ? err.message : 'The sample could not be loaded. Try again.');
    } finally { if (gate.current.isCurrent(token)) setBusy(false); }
  }

  function openSource(ref: SourceRef) {
    setSelectedSource(ref.docId); setSpan(ref);
    sourceViewer.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    sourceViewer.current?.focus({ preventScroll: true });
  }

  function sourceLinks(refs: SourceRef[]) {
    return <div className="refs astra-refs">{refs.filter((r, i, all) => all.findIndex(x => x.docId === r.docId && x.start === r.start && x.end === r.end) === i).map((ref, i) =>
      <button key={i} className="ref" onClick={() => openSource(ref)} aria-label={`Read ${ref.docId}, page ${ref.page}, lines ${ref.start} to ${ref.end}`}>
        <FileText size={13}/>{ref.docId} · L{ref.start}{ref.end !== ref.start ? `–${ref.end}` : ''}<ChevronRight size={13}/>
      </button>)}</div>;
  }

  return <section className="astra-workspace" aria-labelledby="astra-title">
    <div className="astra-heading">
      <div className="astra-identity"><div className="astra-mark"><MessageCircle size={25}/></div><div><span className="astra-overline">CASEWORKER ASSISTANT · CONCEPT PREVIEW</span><h2 id="astra-title">Explore the sample assistant</h2><p>Understand the record. Find the gaps. Prepare a thoughtful next step.</p></div></div>
      <span className="astra-offline"><LockKeyhole size={14}/>Deterministic · no live AI</span>
    </div>
    <div className="astra-preview-note"><ShieldCheck size={19}/><p><strong>Fictional records only.</strong> Responses below are local deterministic templates, not AI-generated answers. Real case data, uploads, and free-text questions are disabled.</p></div>

    <div className="astra-grid">
      <div className="astra-main">
        <section className="panel astra-composer" aria-labelledby="astra-question-title">
          <div className="section-title"><h3 id="astra-question-title">Start with a question</h3><span>Selected packet: {fixture.label}</span></div>
          <div className="astra-prompts">{astraTopics.map((item, i) => {
            const Icon = [BookOpen, HeartHandshake, ExternalLink, CircleHelp][i];
            return <button key={item.id} className={topic === item.id ? 'active' : ''} aria-pressed={topic === item.id} onClick={() => { setTopic(item.id); clear(); }}><Icon size={18}/>{item.label}</button>;
          })}</div>
          <p className="astra-question">{astraTopics.find(t => t.id === topic)?.question}</p>
          <div className="astra-actions"><button className="primary" onClick={() => showSample()} disabled={busy}>{busy ? <span className="spinner"/> : <MessageCircle size={17}/>} {busy ? 'Preparing local sample…' : result ? 'Show sample again' : 'Show sample response'}</button>{busy ? <button onClick={() => clear('Sample cancelled. Nothing was saved.')}><X size={16}/>Cancel</button> : result && <button onClick={() => clear('Sample dismissed. Review checks were cleared; your temporary evidence run is unchanged.')}><X size={16}/>Dismiss sample</button>}</div>
          <p className="astra-helper">Preset questions keep this preview fictional. Free-text questions and real records are disabled.</p>
        </section>

        {error && <div className="alert error" role="alert">{error}<button onClick={() => showSample()}><RotateCcw size={16}/>Retry sample</button></div>}
        {notice && <p className="astra-session-notice" role="status">{notice}</p>}
        <div aria-live="polite" aria-busy={busy}>
          {result ? <section className="panel astra-answer" aria-label="Sample assistant response">
            <div className="section-title"><h3><MessageCircle size={19}/>Sample response</h3><span className="astra-sample-badge">UNREVIEWED SAMPLE</span></div>
            <p className="astra-answer-context">{result.caseId} · {fixture.label} · Bound to this fictional packet</p>
            {result.facts.length > 0 && <section className="astra-answer-section"><div className="astra-section-label"><BookOpen size={17}/>What the sources say</div>{result.facts.map((fact, i) => <article className="astra-fact" key={i}><p>{fact.text}</p>{sourceLinks(fact.refs)}</article>)}</section>}
            {result.observations.length > 0 && <section className="astra-answer-section"><div className="astra-section-label"><CircleHelp size={17}/>Unresolved evidence checks</div>{result.observations.map((fact, i) => <article className="astra-fact" key={i}><p>{fact.text}</p>{sourceLinks(fact.refs)}</article>)}</section>}
            <section className="astra-answer-section astra-unknowns"><div className="astra-section-label"><CircleHelp size={17}/>What is still unknown</div><ul>{result.missing.map(item => <li key={item}>{item}</li>)}</ul></section>
            {topic === 'resources' && <div className="astra-resources"><div className="astra-section-label"><ExternalLink size={17}/>Public resource shelf</div><p>General reference only. Link contents and availability are not checked by this demo. They are not live search results or evidence about this person.</p>{publicResources.map(resource => <article key={resource.url}><span className="astra-overline">{resource.agency}</span><a href={resource.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{resource.title}<ExternalLink size={15}/><span className="sr-only"> (opens a new tab)</span></a><p>{resource.description}</p><small>{resource.review}</small></article>)}<p className="astra-public-boundary"><LockKeyhole size={15}/>Opening a link visits a third-party site with no case text, case identifiers, or referrer from this demo. Do not enter personal financial or medical details into public search.</p></div>}
            <section className="astra-answer-section"><div className="astra-section-label"><HeartHandshake size={17}/>Questions for the conversation</div><ul>{result.questions.map(item => <li key={item}>{item}</li>)}</ul></section>
            <div className="astra-human-boundary"><ShieldCheck size={20}/><p>{result.boundary}</p></div>
            <section className="astra-review"><h3>Before a caseworker acts</h3><p>Practice a human review. These checkboxes are temporary, stay in this tab, and do not accept or save a draft.</p>{[
              ['sources', 'I checked the cited source lines and their limits.'],
              ['unknowns', 'I kept missing information and conflicting values unresolved.'],
              ['authority', 'I would confirm consent, authority, and the person’s priorities before any real action.'],
            ].map(([id, label]) => <label key={id}><input type="checkbox" checked={reviewed.includes(id)} onChange={e => setReviewed(current => e.target.checked ? [...current, id] : current.filter(x => x !== id))}/><span>{label}</span></label>)}{reviewed.length === 3 && <p className="astra-session-notice" role="status"><Check size={16}/>Practice review complete. No decision, acceptance, or record change was made.</p>}</section>
            <div className="astra-provenance"><span>Local template · 0 model calls · 0 tokens</span><span>Source fingerprint: {result.sourceHash.slice(0, 16)}</span></div>
          </section> : !busy && <section className="panel astra-start"><div className="astra-start-icon"><HeartHandshake size={29}/></div><h3>A fuller picture, with evidence attached.</h3><p>Explore financial records, self-reported medical-access needs, and questions a caseworker could discuss with the person. Each sample keeps facts, unknowns, and public references separate.</p><button onClick={onEvidence}><BookOpen size={16}/>Open existing evidence review</button></section>}
        </div>
      </div>

      <aside className="astra-sidebar">
        <section className="panel astra-source" ref={sourceViewer} tabIndex={-1} aria-label="Astra fictional source viewer">
          <div className="section-title"><h3><FileText size={18}/>Fictional source packet</h3><span>Read-only</span></div>
          <label htmlFor="astra-source-select" className="sr-only">Choose a fictional source</label><select id="astra-source-select" value={doc.id} onChange={e => { setSelectedSource(e.target.value); setSpan(null); }}>{docs.map(item => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select>
          <div className="paper"><div className="paper-top"><span>SYNTHETIC PREVIEW RECORD</span><span>v{doc.version} · p1</span></div><h3>{doc.title}</h3>{doc.lines ? <div className="source-lines">{doc.lines.map((line, i) => <div key={i} className={span?.docId === doc.id && i + 1 >= span.start && i + 1 <= span.end ? 'highlight' : ''}><span className="line-number">{i + 1}</span><p>{line}</p></div>)}</div> : <p className="astra-source-empty">This source is unreadable. Its contents are not inferred.</p>}</div>
          {span && <p className="span-caption"><Check size={14}/>Verified excerpt · {span.hash.slice(0, 10)} · lines {span.start}–{span.end}</p>}
          <p className="astra-helper">ASTRA-S01 is a separate fictional supplement. It does not alter the temporary evidence packet, draft, or review history.</p>
        </section>
        <details className="astra-connection"><summary><LockKeyhole size={17}/>How this public demo works</summary><p>All evidence checks and sample answers run locally in your browser using bundled fictional records.</p><ul><li>No sign-in, uploads, shared records, live model, or connector</li><li>No case-data network requests, cookies, or browser storage</li><li>Practice checks and notes disappear on reload or Reset</li><li>No working watsonx Orchestrate integration is claimed</li></ul><p>Browser guards illustrate a review workflow. They are not authentication or tamper-proof security.</p></details>
      </aside>
    </div>
  </section>;
}
