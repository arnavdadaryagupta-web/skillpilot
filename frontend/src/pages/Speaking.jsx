import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { usePilot } from '../context.jsx';
import { speechSupport, useSpeech } from '../hooks/useSpeech.js';

// Pace inside 110-160 wpm scores full marks; fillers and a pace outside the range lower it.
function speakingScore(fb) {
  if (!fb.words) return 0;
  const off = fb.wpm < 110 ? 110 - fb.wpm : fb.wpm > 160 ? fb.wpm - 160 : 0;
  const fillers = Object.values(fb.fillers).reduce((a, b) => a + b, 0);
  const fillerRate = (fillers / fb.words) * 100;
  return Math.max(20, 100 - Math.min(40, off * 0.8) - Math.min(30, fillerRate * 4));
}

export default function Speaking() {
  const { addResult } = usePilot();
  const [level, setLevel] = useState('medium');
  const [topic, setTopic] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [fb, setFb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const speech = useSpeech();

  const newTopic = async (lv = level) => {
    setFb(null); setTranscript(''); setSeconds(0); setError('');
    try { setTopic(await api.speakingTopic(lv)); } catch (e) { setError(e.message); }
  };
  useEffect(() => { newTopic(); /* eslint-disable-next-line */ }, []);
  useEffect(() => () => clearInterval(timer.current), []);

  const begin = () => {
    setFb(null); setSeconds(0); setRunning(true);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    if (speechSupport.listen) speech.listen(transcript, setTranscript);
  };
  const stop = () => {
    clearInterval(timer.current); setRunning(false); speech.stopListening();
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.speakingFeedback({ topic: topic.topic, transcript, duration_seconds: Math.max(seconds, 1) });
      setFb(r);
      addResult('speaking', speakingScore(r), level);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <section className="page">
      <h1>Speaking topics</h1>
      <div className="row">
        <label>Difficulty
          <select value={level} onChange={(e) => { setLevel(e.target.value); newTopic(e.target.value); }}>
            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
        </label>
        <button className="ghost" onClick={() => newTopic()} disabled={running}>New topic</button>
      </div>
      {topic && <div className="panel question"><p className="q-text">{topic.topic}</p><p className="timer">{mm}:{ss}</p></div>}
      <div className="actions">
        {!running
          ? <button className="primary" onClick={begin}>Start speaking</button>
          : <button className="primary" onClick={stop}>Stop</button>}
      </div>
      {(speech.micError || error) && <p className="error" role="alert">{speech.micError || error}</p>}
      <label className="answer">
        {speechSupport.listen ? 'What we heard (you can edit it)' : 'Type what you said'}
        <textarea rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
      </label>
      <button className="primary" onClick={submit} disabled={busy || running || !transcript.trim() || seconds === 0}>
        {busy ? 'Reviewing…' : 'Get feedback'}
      </button>

      {fb && (
        <div className="panel">
          <div className="stats">
            <div><span className="big">{fb.wpm}</span><span>words per minute</span></div>
            <div><span className="big">{fb.words}</span><span>words</span></div>
            <div><span className="big">{Object.values(fb.fillers).reduce((a, b) => a + b, 0)}</span><span>filler words</span></div>
          </div>
          {Object.keys(fb.fillers).length > 0 && (
            <p className="muted">Fillers: {Object.entries(fb.fillers).map(([k, v]) => `${k} ×${v}`).join(', ')}</p>
          )}
          <p>{fb.summary}</p>
          <ul>{fb.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
