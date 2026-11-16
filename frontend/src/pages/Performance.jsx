import { Link } from 'react-router-dom';
import { usePilot } from '../context.jsx';

const AREAS = [
  { type: 'interview', label: 'Voice interview', to: '/interview', tip: 'Add a real example with a result to each answer.' },
  { type: 'test', label: 'Mock test', to: '/test', tip: 'Review the explanations, then retake on a new topic.' },
  { type: 'grammar', label: 'Grammar', to: '/grammar', tip: 'Check one email or answer a day to build the habit.' },
  { type: 'speaking', label: 'Speaking', to: '/speaking', tip: 'Aim for 110-160 words per minute and pause instead of using fillers.' },
  { type: 'discussion', label: 'Group discussion', to: '/discussion', tip: 'Speak 3-4 times and back each point with an example.' },
];

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function grade(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Improving';
  return 'Getting started';
}

export default function Performance() {
  const { results, clearResults } = usePilot();

  const rows = AREAS.map((a) => {
    const list = results.filter((r) => r.type === a.type);
    const recent = list.slice(-3).map((r) => r.score); // recent attempts count most
    return {
      ...a,
      attempts: list.length,
      score: avg(recent),
      best: list.length ? Math.max(...list.map((r) => r.score)) : null,
      last: list.length ? list[list.length - 1].score : null,
    };
  });
  const tried = rows.filter((r) => r.score !== null);
  const overall = avg(tried.map((r) => r.score));
  const weakest = [...tried].sort((a, b) => a.score - b.score)[0];
  const untried = rows.filter((r) => r.score === null);

  if (!results.length) {
    return (
      <section className="page">
        <h1>Overall performance</h1>
        <p className="lede">Nothing to show yet. Finish a voice interview, mock test, grammar check, speaking topic or group discussion and your scores will collect here.</p>
        <div className="actions">{AREAS.map((a) => <Link key={a.type} className="ghost linkbtn" to={a.to}>{a.label}</Link>)}</div>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Overall performance</h1>
      <div className="panel overall">
        <div className="ring" style={{ '--p': overall }} role="img" aria-label={`Overall score ${overall} out of 100`}>
          <span>{overall}</span>
        </div>
        <div>
          <h2>{grade(overall)}</h2>
          <p>Average of your latest 3 attempts in each area you have tried ({tried.length} of {AREAS.length} areas).</p>
          {weakest && tried.length > 1 && (
            <p className="tip">Focus next on <strong>{weakest.label}</strong>. {weakest.tip}</p>
          )}
        </div>
      </div>

      <h2>By area</h2>
      {rows.map((r) => (
        <div className="panel area" key={r.type}>
          <div className="between">
            <strong>{r.label}</strong>
            {r.score === null
              ? <Link to={r.to}>Try it</Link>
              : <span className="muted">{r.attempts} attempt{r.attempts > 1 ? 's' : ''} · best {r.best} · last {r.last}</span>}
          </div>
          <div className="bar" role="img" aria-label={r.score === null ? 'Not attempted' : `${r.score} out of 100`}>
            <span style={{ width: `${r.score ?? 0}%` }} />
          </div>
          <span className="bar-num">{r.score === null ? 'Not tried yet' : `${r.score}/100`}</span>
        </div>
      ))}
      {untried.length > 0 && <p className="note">Try {untried.map((u) => u.label).join(', ')} to complete your overall picture.</p>}

      <h2>Recent activity</h2>
      <ul className="history">
        {[...results].reverse().slice(0, 8).map((r, i) => (
          <li key={i}>
            <span>{AREAS.find((a) => a.type === r.type)?.label}{r.detail ? ` · ${r.detail}` : ''}</span>
            <span className="muted">{new Date(r.at).toLocaleDateString()}</span>
            <strong>{r.score}</strong>
          </li>
        ))}
      </ul>
      <button className="ghost" onClick={() => window.confirm('Delete all saved scores?') && clearResults()}>Reset scores</button>
    </section>
  );
}
