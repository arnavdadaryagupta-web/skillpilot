const API = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach the SkillPilot server. Check that the backend is running on port 8000.');
  }
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : 'Please check what you entered and try again.');
  }
  return res.json();
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  recommend: (profile) => post('/api/career/recommend', profile),
  prep: (role, level) => post('/api/career/prep', { role, level }),
  generateTest: (body) => post('/api/tests/generate', body),
  submitTest: (id, answers) => post(`/api/tests/${id}/submit`, { answers }),
  checkGrammar: (text) => post('/api/grammar/check', { text }),
  speakingTopic: (level) => request(`/api/speaking/topic?level=${level}`),
  speakingFeedback: (body) => post('/api/speaking/feedback', body),
  gdStart: (topic) => post('/api/gd/start', { topic }),
  gdTurn: (body) => post('/api/gd/turn', body),
  gdEvaluate: (body) => post('/api/gd/evaluate', body),
};

export function interviewSocketUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (API) return API.replace(/^http/, 'ws') + '/ws/interview';
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws/interview`;
}
