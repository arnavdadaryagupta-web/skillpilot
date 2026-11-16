import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import ChipPicker from '../components/ChipPicker.jsx';
import { usePilot } from '../context.jsx';
import { DEGREES, INTERESTS, SKILLS, STAGES } from '../data/options.js';

export default function Profile() {
  const { profile, setProfile, setCareers } = usePilot();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const set = (k) => (e) => setProfile({ ...profile, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!profile.skills.length && !profile.interests.length) {
      setError('Select at least one skill or interest so we can match careers.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { careers } = await api.recommend({
        name: profile.name,
        education: [profile.degree, profile.stage].filter(Boolean).join(', '),
        experience_level: profile.experience_level,
        skills: profile.skills,
        interests: profile.interests,
        goals: profile.goals,
      });
      setCareers(careers);
      navigate('/careers');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <div className="hero">
        <h1>Tell SkillPilot where you are</h1>
        <p className="lede">Pick the options that describe you. The more you select, the better the career matches.</p>
        <span className="hero-art" aria-hidden="true">✈️</span>
      </div>
      <form className="panel form" onSubmit={submit}>
        <label>Your name<input value={profile.name} onChange={set('name')} /></label>

        <div className="row">
          <label>
            Education
            <select value={profile.degree} onChange={set('degree')}>
              <option value="">Select your education</option>
              {DEGREES.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((i) => <option key={i}>{i}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Current stage
            <select value={profile.stage} onChange={set('stage')}>
              <option value="">Select stage</option>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Experience level
            <select value={profile.experience_level} onChange={set('experience_level')}>
              <option value="student">Student</option>
              <option value="fresher">Recent graduate</option>
              <option value="working">Working professional</option>
              <option value="switcher">Changing careers</option>
            </select>
          </label>
        </div>

        <ChipPicker title="Skills" groups={SKILLS} value={profile.skills}
          onChange={(skills) => setProfile({ ...profile, skills })} customPlaceholder="Another skill? Type it and press Add" />
        <ChipPicker title="Interests" groups={INTERESTS} value={profile.interests}
          onChange={(interests) => setProfile({ ...profile, interests })} customPlaceholder="Another interest? Type it and press Add" />

        <label>What do you want from your career? (optional)
          <textarea rows={3} value={profile.goals} onChange={set('goals')} placeholder="e.g. a stable job in tech, or to start my own business" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Finding matches…' : 'Find my careers'}</button>
      </form>
    </section>
  );
}
