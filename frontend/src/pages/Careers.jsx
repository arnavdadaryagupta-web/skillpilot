import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { usePilot } from '../context.jsx';

export default function Careers() {
  const { careers, profile, setRole } = usePilot();
  const [prep, setPrep] = useState({}); // title -> material
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (!careers.length) {
    return (
      <section className="page">
        <h1>Career matches</h1>
        <p className="lede">No matches yet. <Link to="/">Fill in your profile</Link> and they will appear here.</p>
      </section>
    );
  }

  const loadPrep = async (c) => {
    setBusy(c.title);
    setError('');
    try {
      const level = profile.experience_level === 'working' ? 'intermediate' : 'beginner';
      setPrep((p) => ({ ...p, [c.title]: null }));
      const data = await api.prep(c.title, level);
      setPrep((p) => ({ ...p, [c.title]: data }));
    } catch (err) {
      setError(err.message);
      setPrep((p) => { const n = { ...p }; delete n[c.title]; return n; });
    } finally {
      setBusy('');
    }
  };

  const practise = (c) => {
    setRole(c.title);
    navigate('/interview');
  };

  return (
    <section className="page">
      <h1>{profile.name ? `${profile.name}, these fit you best` : 'Careers that fit you best'}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {careers.map((c, i) => (
        <article className={`panel career ${i === 0 ? 'top' : ''}`} key={c.title}>
          <div className="between">
            <h2>{c.title}</h2>
            <span className="match" aria-label={`${c.match} percent match`}>{c.match}%</span>
          </div>
          <p>{c.why}</p>
          <h3>Skills to build</h3>
          <ul className="chips">{c.skills_to_build.map((s) => <li key={s}>{s}</li>)}</ul>
          <h3>Roadmap</h3>
          <ol className="steps">{c.roadmap.map((s, j) => <li key={j}>{s}</li>)}</ol>
          <div className="actions">
            <button className="primary" onClick={() => loadPrep(c)} disabled={busy === c.title}>
              {busy === c.title ? 'Preparing…' : prep[c.title] ? 'Refresh prep material' : 'Get prep material'}
            </button>
            <button className="ghost" onClick={() => practise(c)}>Practise interview for this role</button>
          </div>
          {prep[c.title] && (
            <div className="prep">
              <p>{prep[c.title].overview}</p>
              <h3>Topics to cover</h3>
              <ul className="chips">{prep[c.title].topics.map((t) => <li key={t}>{t}</li>)}</ul>
              <h3>Weekly plan</h3>
              <ol className="steps">{prep[c.title].plan.map((p) => <li key={p.week}><strong>Week {p.week}.</strong> {p.focus}</li>)}</ol>
              <h3>Where to learn</h3>
              <ul>{prep[c.title].resources?.map((r, k) => <li key={k}>{r}</li>)}</ul>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
