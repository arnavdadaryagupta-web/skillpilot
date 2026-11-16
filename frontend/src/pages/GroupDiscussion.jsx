import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { usePilot } from '../context.jsx';

export default function GroupDiscussion() {
  const { addResult } = usePilot();
  const [topicInput, setTopicInput] = useState('');
  const [topic, setTopic] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const start = async () => {
    setBusy(true); setError(''); setReport(null);
    try {
      const d = await api.gdStart(topicInput);
      setTopic(d.topic); setMessages(d.messages);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const send = async () => {
    const mine = { speaker: 'You', text: text.trim() };
    if (!mine.text) return;
    const history = messages;
    setMessages([...history, mine]); setText(''); setBusy(true); setError('');
    try {
      const d = await api.gdTurn({ topic, history, user_message: mine.text });
      setMessages((m) => [...m, ...d.messages]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const finish = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.gdEvaluate({ topic, history: messages });
      setReport(r);
      addResult('discussion', Number(r.score) || 0, topic.slice(0, 40));
    }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!topic) {
    return (
      <section className="page">
        <h1>Group discussion</h1>
        <p className="lede">Practise with three AI panelists who agree, disagree, and ask for examples. Leave the topic empty for a random one.</p>
        <div className="panel form">
          <label>Topic<input value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="e.g. Should coding be taught in every school?" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" onClick={start} disabled={busy}>{busy ? 'Setting up…' : 'Join discussion'}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="between"><h1>{topic}</h1>
        <button className="ghost" onClick={() => { setTopic(''); setMessages([]); setReport(null); }}>Leave</button></div>
      <div className="chat" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.speaker === 'You' ? 'me' : ''}`}>
            <span className="who">{m.speaker}</span>{m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!report && (
        <>
          <label className="answer">Your point
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !busy) send(); }} />
          </label>
          <div className="actions">
            <button className="primary" onClick={send} disabled={busy || !text.trim()}>{busy ? 'Panel is replying…' : 'Add to discussion'}</button>
            <button className="ghost" onClick={finish} disabled={busy || messages.every((m) => m.speaker !== 'You')}>End and evaluate me</button>
          </div>
        </>
      )}
      {report && (
        <div className="panel">
          <div className="score-banner"><span className="big">{report.score}</span><span>discussion score</span></div>
          <p>{report.summary}</p>
          <div className="two">
            <div><h3>Strengths</h3><ul>{report.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            <div><h3>To improve</h3><ul>{report.improve?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          </div>
        </div>
      )}
    </section>
  );
}
