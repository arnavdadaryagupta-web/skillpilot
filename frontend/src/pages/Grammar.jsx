import { useState } from 'react';
import { api } from '../api.js';
import { usePilot } from '../context.jsx';

export default function Grammar() {
  const { addResult } = usePilot();
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const check = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.checkGrammar(text);
      setRes(r);
      addResult('grammar', r.score);
    }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="page">
      <h1>Grammar improvement</h1>
      <p className="lede">Paste an email, cover letter, or an answer you plan to give. You get a corrected version and the reason for each change.</p>
      <label className="answer">
        Your text
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" onClick={check} disabled={busy || !text.trim()}>{busy ? 'Checking…' : 'Check grammar'}</button>

      {res && (
        <>
          <div className="panel score-banner"><span className="big">{res.score}</span><span>writing score</span></div>
          <div className="panel"><h2>Corrected text</h2><p className="pre">{res.corrected}</p>
            <button className="ghost" onClick={() => navigator.clipboard?.writeText(res.corrected)}>Copy corrected text</button>
          </div>
          {res.issues.length === 0 ? <p className="ok">No issues found.</p> : (
            <div className="panel">
              <h2>What changed</h2>
              <ul className="changes">
                {res.issues.map((it, i) => (
                  <li key={i}><s>{it.original}</s> → <strong>{it.suggestion}</strong><br /><span className="muted">{it.explanation}</span></li>
                ))}
              </ul>
            </div>
          )}
          {res.note && <p className="note">{res.note}</p>}
        </>
      )}
    </section>
  );
}
