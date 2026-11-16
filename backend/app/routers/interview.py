"""Voice interviewer over WebSocket.

Protocol (JSON messages)
  client → server
    {"type": "start",  "role": str, "level": str, "num_questions": int}
    {"type": "answer", "text": str}
    {"type": "end"}                      finish early and get a summary
    {"type": "ping"}
  server → client
    {"type": "question", "index": int, "total": int, "text": str}
    {"type": "feedback", "score": int, "feedback": str, "tip": str}
    {"type": "summary",  "average": float, "strengths": [...], "improve": [...], "summary": str}
    {"type": "empty"}                    the answer was blank, ask again
    {"type": "error",    "message": str}
    {"type": "pong"}

Session state lives in the connection, so a dropped socket means a fresh interview.
"""
import logging
import re
from dataclasses import dataclass, field
from typing import List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..ai import ask_json

router = APIRouter(tags=["interview"])
log = logging.getLogger("skillpilot.interview")

FALLBACK_QUESTIONS = [
    "Tell me about yourself and why you are interested in the {role} role.",
    "Describe a project you are proud of. What was your part in it?",
    "What is the hardest problem you have solved, and how did you approach it?",
    "Tell me about a time you worked in a team and disagreed with someone. What happened?",
    "Which skills do you most want to improve for a {role} position, and what are you doing about it?",
    "How do you prioritise when you have several deadlines at once?",
    "Where do you see yourself in three years?",
    "Do you have any questions for me?",
]


@dataclass
class Session:
    role: str
    level: str
    questions: List[str]
    index: int = 0
    results: List[dict] = field(default_factory=list)


async def _generate_questions(role: str, level: str, n: int) -> List[str]:
    fallback = [q.format(role=role) for q in FALLBACK_QUESTIONS][:n]
    prompt = (
        f"Write {n} interview questions for a {level} candidate applying for '{role}'. Start with a warm-up question, "
        "mix behavioural and role-specific questions, and keep each under 30 words so it sounds natural when spoken. "
        'Return JSON: {"questions":[str]}.'
    )
    data = await ask_json(
        "You are a friendly but rigorous interviewer.", prompt, {"questions": fallback},
        validate=lambda d: isinstance(d, dict) and isinstance(d.get("questions"), list) and len(d["questions"]) >= 1,
    )
    return [str(q) for q in data["questions"]][:n]


def _heuristic_eval(answer: str) -> dict:
    words = len(answer.split())
    score = 3 + min(4, words // 20)
    if re.search(r"\b(for example|for instance|when i|i worked|i built|i led)\b", answer, re.I):
        score += 1
    if re.search(r"\d", answer) or re.search(r"\b(result|outcome|improved|reduced|increased)\b", answer, re.I):
        score += 1
    score = max(1, min(10, score))
    if words < 25:
        fb, tip = "Your answer was quite short.", "Aim for 45–90 seconds. Use a situation, your action, and the result."
    elif score >= 8:
        fb, tip = "Clear and specific. You backed your points with evidence.", "Keep it tight and end with what you learned."
    else:
        fb, tip = "Good start, but it needs a concrete example.", "Add one real example with a measurable result."
    return {"score": score, "feedback": fb, "tip": tip}


async def _evaluate(session: Session, question: str, answer: str) -> dict:
    prompt = (
        f"Role: {session.role} ({session.level}).\nQuestion: {question}\nCandidate's spoken answer: {answer}\n"
        'Judge it like an interviewer. Return JSON: {"score":int 1-10,"feedback":str (max 2 sentences),'
        '"tip":str (one specific improvement)}. The answer is a speech transcript, so ignore punctuation errors.'
    )
    data = await ask_json("You are a fair interview coach.", prompt, lambda: _heuristic_eval(answer),
                          max_tokens=500, validate=lambda d: isinstance(d, dict) and "score" in d)
    data["score"] = max(1, min(10, int(data["score"])))
    data.setdefault("feedback", "")
    data.setdefault("tip", "")
    return data


async def _summarise(session: Session) -> dict:
    if not session.results:
        return {"type": "summary", "average": 0, "strengths": [], "improve": ["No answers were recorded."],
                "summary": "The interview ended before any question was answered."}
    avg = round(sum(r["score"] for r in session.results) / len(session.results), 1)

    def fallback():
        return {
            "strengths": ["You completed the interview."] + (["Your best answers were specific."] if avg >= 7 else []),
            "improve": [r["tip"] for r in session.results if r["score"] <= 6 and r["tip"]][:3]
            or ["Keep practising to stay consistent."],
            "summary": f"You averaged {avg}/10 across {len(session.results)} answers.",
        }

    log_text = "\n".join(f"Q: {r['question']}\nA: {r['answer']}\nScore: {r['score']}" for r in session.results)
    data = await ask_json(
        "You are an interview coach writing a final debrief.",
        f"Role: {session.role}\n{log_text}\nReturn JSON: "
        '{"strengths":[str x2-3],"improve":[str x2-3],"summary":str (2 sentences)}.',
        fallback, validate=lambda d: isinstance(d, dict) and isinstance(d.get("improve"), list),
    )
    return {"type": "summary", "average": avg, **data}


def _question_msg(s: Session) -> dict:
    return {"type": "question", "index": s.index, "total": len(s.questions), "text": s.questions[s.index]}


@router.websocket("/ws/interview")
async def interview_ws(ws: WebSocket):
    await ws.accept()
    session: Session | None = None
    try:
        while True:
            try:
                msg = await ws.receive_json()
            except ValueError:
                await ws.send_json({"type": "error", "message": "Messages must be valid JSON."})
                continue
            if not isinstance(msg, dict):
                await ws.send_json({"type": "error", "message": "Messages must be JSON objects."})
                continue

            kind = msg.get("type")

            if kind == "ping":
                await ws.send_json({"type": "pong"})

            elif kind == "start":
                role = str(msg.get("role") or "General").strip()[:80]
                level = str(msg.get("level") or "entry").strip()[:30]
                try:
                    n = max(3, min(10, int(msg.get("num_questions", 5))))
                except (TypeError, ValueError):
                    n = 5
                session = Session(role, level, await _generate_questions(role, level, n))
                await ws.send_json(_question_msg(session))

            elif kind == "answer":
                if session is None:
                    await ws.send_json({"type": "error", "message": "Start the interview first."})
                    continue
                answer = str(msg.get("text") or "").strip()[:3000]
                if not answer:
                    await ws.send_json({"type": "empty"})
                    continue
                question = session.questions[session.index]
                result = await _evaluate(session, question, answer)
                session.results.append({"question": question, "answer": answer, **result})
                await ws.send_json({"type": "feedback", "score": result["score"],
                                    "feedback": result["feedback"], "tip": result["tip"]})
                session.index += 1
                if session.index < len(session.questions):
                    await ws.send_json(_question_msg(session))
                else:
                    await ws.send_json(await _summarise(session))
                    session = None

            elif kind == "end":
                if session is not None:
                    await ws.send_json(await _summarise(session))
                    session = None

            else:
                await ws.send_json({"type": "error", "message": f"Unknown message type: {kind!r}"})
    except WebSocketDisconnect:
        log.info("Interview client disconnected")
    except Exception:  # noqa: BLE001
        log.exception("Interview socket crashed")
        try:
            await ws.close(code=1011)
        except RuntimeError:
            pass
