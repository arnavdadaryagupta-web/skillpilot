import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PilotContext = createContext(null);

const EMPTY = {
  name: '', degree: '', stage: '', experience_level: 'student', skills: [], interests: [], goals: '',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Older versions saved skills/interests as comma-separated text.
const toList = (v) => (Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean));

export function PilotProvider({ children }) {
  const [profile, setProfile] = useState(() => {
    const p = { ...EMPTY, ...load('sp.profile', {}) };
    return { ...p, skills: toList(p.skills), interests: toList(p.interests) };
  });
  const [careers, setCareers] = useState(() => load('sp.careers', []));
  const [role, setRole] = useState(() => load('sp.role', ''));
  const [results, setResults] = useState(() => load('sp.results', []));

  useEffect(() => {
    try {
      localStorage.setItem('sp.profile', JSON.stringify(profile));
      localStorage.setItem('sp.careers', JSON.stringify(careers));
      localStorage.setItem('sp.role', JSON.stringify(role));
      localStorage.setItem('sp.results', JSON.stringify(results));
    } catch {
      /* storage may be unavailable; the app still works for this session */
    }
  }, [profile, careers, role, results]);

  // type: interview | test | grammar | speaking | discussion; score: 0-100
  const addResult = useCallback((type, score, detail = '') => {
    const entry = { type, score: Math.max(0, Math.min(100, Math.round(score))), detail, at: Date.now() };
    setResults((r) => [...r, entry].slice(-200));
  }, []);
  const clearResults = useCallback(() => setResults([]), []);

  return (
    <PilotContext.Provider
      value={{ profile, setProfile, careers, setCareers, role, setRole, results, addResult, clearResults }}
    >
      {children}
    </PilotContext.Provider>
  );
}

export const usePilot = () => useContext(PilotContext);
