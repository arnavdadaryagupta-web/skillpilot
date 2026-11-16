import { useState } from 'react';
import { api } from '../api.js';
import { usePilot } from '../context.jsx';

export default function MockTest() {
  const { role: savedRole, addResult } = usePilot();
  const [role, setRole] = useState(savedRole || 'general');
  const [topic, setTopic] = useState('aptitude');
  const [count, setCount] = useState(5);
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const t = await api.generateTest({ role, topic, count });
      setTest(t);
      setAnswers(Array(t.questions.length).fill(null));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.submitTest(test.test_id, answers);
      setResult(r);
      addResult('test', (r.score / r.total) * 100, topic);
    }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <section className="page">
      <h1>Mock test</h1>
      <p className="lede">Answer every question, submit, and read why each answer is right or wrong.</p>
      <div className="panel form">
        <div className="row">
          <label>Role<input value={role} onChange={(e) => setRole(e.target.value)} /></label>
          <label>Topic<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="aptitude, SQL, logic…" /></label>
          <label>Questions
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <button className="primary" onClick={generate} disabled={busy}>{busy && !test ? 'Preparing…' : test ? 'New test' : 'Start test'}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {test && !result && (
        <>
          {test.questions.map((q, i) => (
            <fieldset className="panel mcq" key={q.id}>
              <legend>{i + 1}. {q.question}</legend>
              {q.options.map((o, j) => (
                <label className="check" key={j}>
                  <input type="radio" name={`q${i}`} checked={answers[i] === j}
                    onChange={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))} />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="primary" onClick={submit} disabled={busy}>Submit answers</button>
        </>
      )}

      {result && (
        <>
          <div className="panel score-banner">
            <span className="big">{result.score}/{result.total}</span>
            <span>correct</span>
          </div>
          {result.review.map((r, i) => (
            <article className="panel" key={i}>
              <strong>{i + 1}. {r.question}</strong>
              <p className={r.selected === r.correct ? 'ok' : 'wrong'}>
                {r.selected === null ? 'You skipped this one.' : `You chose: ${r.options[r.selected]}`}
              </p>
              {r.selected !== r.correct && <p>Correct answer: {r.options[r.correct]}</p>}
              <p className="tip">{r.explanation}</p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
