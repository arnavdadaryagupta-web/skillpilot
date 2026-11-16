import { useCallback, useEffect, useRef, useState } from 'react';
import { interviewSocketUrl } from '../api.js';
import { usePilot } from '../context.jsx';
import { speechSupport, useSpeech } from '../hooks/useSpeech.js';

const LEVELS = ['entry', 'mid', 'senior'];

export default function Interview() {
  const { role: savedRole, setRole, addResult } = usePilot();
  const [role, setLocalRole] = useState(savedRole || '');
  const [level, setLevel] = useState('entry');
  const [count, setCount] = useState(5);
  const [voiceOn, setVoiceOn] = useState(speechSupport.speak);

  // phase: setup | connecting | live | done
  const [phase, setPhase] = useState('setup');
  const [question, setQuestion] = useState(null); // {index,total,text}
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState([]); // [{question, answer, feedback}]
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | speaking | listening | thinking
  const [error, setError] = useState('');

  const speech = useSpeech();
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const questionRef = useRef(null);
  const answerRef = useRef('');
  const finishedRef = useRef(false);
  const roleRef = useRef('');
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;

  const closeSocket = useCallback(() => {
    clearInterval(pingRef.current);
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }, []);

  useEffect(() => closeSocket, [closeSocket]);

  const askQuestion = useCallback(
    async (q) => {
      questionRef.current = q;
      setQuestion(q);
      setDraft('');
      if (voiceRef.current && speechSupport.speak) {
        setStatus('speaking');
        await speech.speak(q.text);
        // The user may have moved on while the voice was talking.
        if (questionRef.current !== q) return;
      }
      if (speechSupport.listen && voiceRef.current) {
        setStatus('listening');
        speech.listen('', setDraft);
      } else {
        setStatus('idle');
      }
    },
    [speech]
  );

  const onMessage = useCallback(
    (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'question':
          setPhase('live');
          askQuestion(msg);
          break;
        case 'feedback':
          setTurns((t) => [
            ...t,
            {
              question: questionRef.current?.text,
              answer: answerRef.current,
              feedback: { score: msg.score, feedback: msg.feedback, tip: msg.tip },
            },
          ]);
          break;
        case 'summary':
          finishedRef.current = true;
          if (msg.average > 0) addResult('interview', msg.average * 10, roleRef.current);
          setSummary(msg);
          setPhase('done');
          setStatus('idle');
          speech.stopListening();
          closeSocket();
          break;
        case 'empty':
          setStatus('idle');
          setError('No answer was captured. Say or type your answer, then send it.');
          break;
        case 'error':
          setStatus('idle');
          setError(msg.message);
          break;
        default:
          break;
      }
    },
    [askQuestion, closeSocket, speech, addResult]
  );

  const start = () => {
    if (!role.trim()) {
      setError('Enter the role you are interviewing for.');
      return;
    }
    setError('');
    setRole(role.trim());
    roleRef.current = role.trim();
    setTurns([]);
    setSummary(null);
    setQuestion(null);
    finishedRef.current = false;
    setPhase('connecting');
    closeSocket();

    const ws = new WebSocket(interviewSocketUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', role: role.trim(), level, num_questions: count }));
      pingRef.current = setInterval(() => ws.readyState === 1 && ws.send('{"type":"ping"}'), 20000);
    };
    ws.onmessage = onMessage;
    ws.onerror = () => setError('Could not connect to the interviewer. Check that the backend is running.');
    ws.onclose = () => {
      clearInterval(pingRef.current);
      if (!finishedRef.current) {
        speech.stopListening();
        speech.stopSpeaking();
        setStatus('idle');
        setError('The connection dropped. Your interview was not saved, so start a new one.');
        setPhase('setup');
      }
    };
  };

  const send = (payload) => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(payload));

  const submit = () => {
    speech.stopListening();
    speech.stopSpeaking();
    setError('');
    answerRef.current = draft.trim();
    setStatus('thinking');
    send({ type: 'answer', text: draft });
  };

  const endEarly = () => {
    speech.stopListening();
    speech.stopSpeaking();
    setStatus('thinking');
    send({ type: 'end' });
  };

  const toggleMic = () => {
    if (speech.listening) {
      speech.stopListening();
      setStatus('idle');
    } else {
      speech.stopSpeaking();
      setStatus('listening');
      speech.listen(draft, setDraft);
    }
  };

  if (phase === 'setup' || phase === 'connecting') {
    return (
      <section className="page">
        <h1>Voice interview</h1>
        <p className="lede">The interviewer asks each question aloud and listens to your answer. You get feedback after every answer.</p>
        <div className="panel form">
          <label>
            Role you are interviewing for
            <input value={role} onChange={(e) => setLocalRole(e.target.value)} placeholder="e.g. Data Analyst" />
          </label>
          <div className="row">
            <label>
              Level
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label>
              Questions
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[3, 5, 7, 10].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
            Speak questions and listen to my answers
          </label>
          {!speechSupport.listen && (
            <p className="note">This browser has no speech recognition. You can still type answers, or use Chrome or Edge for voice.</p>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" onClick={start} disabled={phase === 'connecting'}>
            {phase === 'connecting' ? 'Connecting…' : 'Start interview'}
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'done' && summary) {
    return (
      <section className="page">
        <h1>Interview debrief</h1>
        <div className="panel score-banner">
          <span className="big">{summary.average}</span>
          <span>average out of 10 for {role}</span>
        </div>
        <p className="lede">{summary.summary}</p>
        <div className="two">
          <div className="panel"><h2>What worked</h2><ul>{summary.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div className="panel"><h2>What to improve</h2><ul>{summary.improve?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
        <h2>Your answers</h2>
        {turns.map((t, i) => <TurnCard key={i} turn={t} />)}
        <button className="primary" onClick={() => setPhase('setup')}>Start another interview</button>
      </section>
    );
  }

  const stateLabel = {
    speaking: 'Interviewer is speaking',
    listening: 'Listening to you',
    thinking: 'Reviewing your answer',
    idle: 'Your turn',
  }[status];

  return (
    <section className="page">
      <div className="between">
        <h1>Question {question ? question.index + 1 : 1} of {question?.total ?? count}</h1>
        <button className="ghost" onClick={endEarly} disabled={status === 'thinking'}>End and get debrief</button>
      </div>
      <div className="panel question">
        <p className="q-text">{question?.text}</p>
        <p className={`state ${status}`} aria-live="polite"><span className="dot" />{stateLabel}</p>
      </div>

      <label className="answer">
        Your answer
        <textarea
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Speak, or type here. You can edit what was heard before sending."
          disabled={status === 'thinking'}
        />
      </label>
      {(error || speech.micError) && <p className="error" role="alert">{error || speech.micError}</p>}
      <div className="actions">
        <button className="primary" onClick={submit} disabled={status === 'thinking' || !draft.trim()}>Send answer</button>
        {speechSupport.listen && (
          <button className="ghost" onClick={toggleMic} disabled={status === 'thinking'}>
            {speech.listening ? 'Pause microphone' : 'Use microphone'}
          </button>
        )}
        {speechSupport.speak && question && (
          <button className="ghost" onClick={() => { speech.stopListening(); speech.speak(question.text); }}>Repeat question</button>
        )}
      </div>

      {turns.length > 0 && (
        <>
          <h2>So far</h2>
          {[...turns].reverse().map((t, i) => <TurnCard key={i} turn={t} />)}
        </>
      )}
    </section>
  );
}

function TurnCard({ turn }) {
  const { score, feedback, tip } = turn.feedback;
  return (
    <article className="panel turn">
      <div className="between">
        <strong>{turn.question}</strong>
        <span className={`pill ${score >= 7 ? 'good' : score >= 5 ? 'mid' : 'low'}`}>{score}/10</span>
      </div>
      <p className="you">{turn.answer}</p>
      <p>{feedback}</p>
      <p className="tip">{tip}</p>
    </article>
  );
}
