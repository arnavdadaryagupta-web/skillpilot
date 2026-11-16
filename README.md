# SkillPilot

AI career guidance: enter your profile, get career matches and prep material, then practise with a voice interviewer, mock tests, grammar checks, speaking topics and group discussions.

**Stack:** FastAPI (REST + WebSocket) · React 18 + Vite · Anthropic API (optional)

## Run it

**Backend** (Python 3.10+)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # add ANTHROPIC_API_KEY for live AI; leave blank for offline mode
uvicorn app.main:app --reload --port 8000
pytest                        # optional: 7 API + WebSocket tests
```

**Frontend** (Node 18+)
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```
Vite proxies `/api` and `/ws` to port 8000, so no CORS or WebSocket URL setup is needed in development. For production set `VITE_API_URL` (e.g. `https://api.example.com`) at build time.

## Features and where they live

| Feature | Backend | Frontend |
|---|---|---|
| Profile (education dropdown, skill and interest pickers) → career matches, roadmap, prep plan | `routers/career.py` | `Profile.jsx`, `ChipPicker.jsx`, `data/options.js`, `Careers.jsx` |
| Overall performance (scores from every practice area, saved in the browser) | none (localStorage) | `Performance.jsx`, `context.jsx` |
| Voice interviewer | `routers/interview.py` (`/ws/interview`) | `Interview.jsx`, `hooks/useSpeech.js` |
| Mock tests (answers stay server-side until submit) | `routers/practice.py` | `MockTest.jsx` |
| Grammar improvement | `routers/practice.py` | `Grammar.jsx` |
| Speaking topics (pace + filler words) | `routers/practice.py` | `Speaking.jsx` |
| Group discussion with 3 AI panelists | `routers/practice.py` | `GroupDiscussion.jsx` |

## Voice interviewer

Messages are JSON; the full protocol is documented at the top of `interview.py`.
Flow: `start` → `question` → `answer` → `feedback` + next `question` … → `summary`.
The browser speaks each question (Web Speech synthesis), then listens (Web Speech recognition) and fills an editable box, so mistakes in what was heard can be fixed before sending. Notes from debugging:

- Chrome stops recognition after a pause even in continuous mode, so `useSpeech` restarts it while the user still wants the mic.
- Recognition starts only after the question finishes speaking, otherwise the mic hears the interviewer.
- A 20 s ping keeps idle connections alive; if the socket drops, the UI tells the user to restart (session state lives in the connection).
- Voice recognition needs Chrome or Edge and microphone permission (localhost counts as secure). Typing always works.

## Offline mode

Every AI call has a fallback (`app/ai.py`), so the app works without a key using built-in questions, heuristics and a rule-based grammar checker. `/api/health` reports `ai_enabled`.

## Ideas for next steps

User accounts and saved progress (database), resume upload, interview recordings, proper timed tests, analytics dashboard.
