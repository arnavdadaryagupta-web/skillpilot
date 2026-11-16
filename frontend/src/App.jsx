import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Profile from './pages/Profile.jsx';
import Careers from './pages/Careers.jsx';
import Interview from './pages/Interview.jsx';
import MockTest from './pages/MockTest.jsx';
import Grammar from './pages/Grammar.jsx';
import Speaking from './pages/Speaking.jsx';
import GroupDiscussion from './pages/GroupDiscussion.jsx';
import Performance from './pages/Performance.jsx';

const STOPS = [
  { to: '/', label: 'Your profile', icon: '🧑‍✈️' },
  { to: '/careers', label: 'Career matches', icon: '🧭' },
  { to: '/interview', label: 'Voice interview', icon: '🎙️' },
  { to: '/test', label: 'Mock test', icon: '📝' },
  { to: '/grammar', label: 'Grammar', icon: '✍️' },
  { to: '/speaking', label: 'Speaking topics', icon: '🗣️' },
  { to: '/discussion', label: 'Group discussion', icon: '👥' },
  { to: '/performance', label: 'Overall performance', icon: '📈' },
];

export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('sp.theme') || 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('sp.theme', theme); } catch { /* ignore */ }
  }, [theme]);

  return (
    <div className="shell">
      <aside className="route">
        <div className="brand"><span className="logo" aria-hidden="true">✈️</span>SkillPilot</div>
        <nav aria-label="Main">
          <ol>
            {STOPS.map((s) => (
              <li key={s.to}>
                <NavLink to={s.to} end={s.to === '/'}>
                  <span className="waypoint" aria-hidden="true">{s.icon}</span>
                  {s.label}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
        <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Profile />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/test" element={<MockTest />} />
          <Route path="/grammar" element={<Grammar />} />
          <Route path="/speaking" element={<Speaking />} />
          <Route path="/discussion" element={<GroupDiscussion />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
