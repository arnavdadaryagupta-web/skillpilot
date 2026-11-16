import random
import re
import uuid
from collections import OrderedDict

from fastapi import APIRouter, HTTPException

from ..ai import ask_json
from ..schemas import (
    GDEvaluate,
    GDStart,
    GDTurn,
    GrammarRequest,
    SpeakingFeedbackRequest,
    TestRequest,
    TestSubmit,
)

router = APIRouter(prefix="/api", tags=["practice"])

# ───────────────────────── Mock tests ─────────────────────────

TEST_BANK = [
    {"question": "What is 15% of 240?", "options": ["24", "32", "36", "40"], "answer_index": 2,
     "explanation": "240 × 0.15 = 36."},
    {"question": "What comes next: 2, 6, 12, 20, 30, ?", "options": ["40", "42", "44", "48"], "answer_index": 1,
     "explanation": "The gaps grow by 2 each time (4, 6, 8, 10, 12), so 30 + 12 = 42."},
    {"question": "A 120 m long train passes a pole in 6 seconds. What is its speed?",
     "options": ["60 km/h", "72 km/h", "80 km/h", "90 km/h"], "answer_index": 1,
     "explanation": "120 m / 6 s = 20 m/s, and 20 × 3.6 = 72 km/h."},
    {"question": "Choose the word closest in meaning to 'concise'.", "options": ["Brief", "Lengthy", "Vague", "Loud"],
     "answer_index": 0, "explanation": "Concise means expressing much in few words, so 'brief'."},
    {"question": "An item bought for ₹400 is sold for ₹500. What is the profit percentage?",
     "options": ["20%", "25%", "30%", "15%"], "answer_index": 1,
     "explanation": "Profit is ₹100 on a cost of ₹400, which is 25%."},
    {"question": "Which one does not belong: Python, Java, C++, HTML?", "options": ["Python", "Java", "C++", "HTML"],
     "answer_index": 3, "explanation": "HTML is a markup language; the others are programming languages."},
]

# Answer keys live on the server so they never reach the browser before submission.
_TESTS: "OrderedDict[str, list]" = OrderedDict()
_MAX_TESTS = 200


def _valid_questions(d) -> bool:
    if not isinstance(d, dict) or not isinstance(d.get("questions"), list) or not d["questions"]:
        return False
    for q in d["questions"]:
        if not (isinstance(q, dict) and isinstance(q.get("options"), list) and len(q["options"]) >= 2
                and isinstance(q.get("answer_index"), int) and 0 <= q["answer_index"] < len(q["options"])
                and q.get("question")):
            return False
    return True


@router.post("/tests/generate")
async def generate_test(req: TestRequest):
    def fallback():
        bank = TEST_BANK[:]
        random.shuffle(bank)
        return {"questions": bank[: req.count]}

    prompt = (
        f"Write {req.count} multiple-choice questions for a '{req.role}' candidate on the topic '{req.topic}'. "
        'Return JSON: {"questions":[{"question":str,"options":[str x4],"answer_index":int 0-3,"explanation":str}]}. '
        "Exactly one option must be correct."
    )
    data = await ask_json("You write fair, unambiguous mock-test questions.", prompt, fallback,
                          max_tokens=2500, validate=_valid_questions)
    questions = data["questions"][: req.count]
    test_id = uuid.uuid4().hex
    _TESTS[test_id] = questions
    while len(_TESTS) > _MAX_TESTS:
        _TESTS.popitem(last=False)
    public = [{"id": i, "question": q["question"], "options": q["options"]} for i, q in enumerate(questions)]
    return {"test_id": test_id, "questions": public}


@router.post("/tests/{test_id}/submit")
def submit_test(test_id: str, body: TestSubmit):
    questions = _TESTS.get(test_id)
    if questions is None:
        raise HTTPException(404, "This test has expired. Generate a new one.")
    review, score = [], 0
    for i, q in enumerate(questions):
        selected = body.answers[i] if i < len(body.answers) else None
        correct = q["answer_index"]
        score += int(selected == correct)
        review.append({
            "question": q["question"], "options": q["options"], "selected": selected,
            "correct": correct, "explanation": q.get("explanation", ""),
        })
    return {"score": score, "total": len(questions), "review": review}


# ───────────────────────── Grammar ─────────────────────────

COMMON = {
    r"\bdont\b": ("don't", "Add an apostrophe in contractions."),
    r"\bcant\b": ("can't", "Add an apostrophe in contractions."),
    r"\bwont\b": ("won't", "Add an apostrophe in contractions."),
    r"\bdidnt\b": ("didn't", "Add an apostrophe in contractions."),
    r"\bim\b": ("I'm", "Write 'I'm' with a capital I and an apostrophe."),
    r"\balot\b": ("a lot", "'A lot' is two words."),
    r"\bteh\b": ("the", "Spelling mistake."),
    r"\brecieve\b": ("receive", "Remember: i before e, except after c."),
    r"\bdefinately\b": ("definitely", "Spelling mistake."),
    r"\bshould of\b": ("should have", "Use 'have', not 'of'."),
    r"\bcould of\b": ("could have", "Use 'have', not 'of'."),
    r"\bwould of\b": ("would have", "Use 'have', not 'of'."),
    r"\bi\b": ("I", "The pronoun 'I' is always capitalised."),
}


def _fallback_grammar(text: str) -> dict:
    issues, fixed = [], text
    if re.search(r" {2,}", fixed):
        issues.append({"original": "double spaces", "suggestion": "single space", "explanation": "Use one space between words."})
        fixed = re.sub(r" {2,}", " ", fixed)
    for pattern, (repl, why) in COMMON.items():
        for m in re.finditer(pattern, fixed):
            if m.group(0) != repl:
                issues.append({"original": m.group(0), "suggestion": repl, "explanation": why})
        fixed = re.sub(pattern, repl, fixed)

    def cap(m):
        return m.group(1) + m.group(2).upper()

    capped = re.sub(r"(^|[.!?]\s+)([a-z])", cap, fixed)
    if capped != fixed:
        issues.append({"original": "lowercase sentence start", "suggestion": "capital letter",
                       "explanation": "Start each sentence with a capital letter."})
        fixed = capped
    if fixed.strip() and fixed.strip()[-1] not in ".!?":
        issues.append({"original": "missing end punctuation", "suggestion": "add a full stop",
                       "explanation": "End the sentence with . ! or ?"})
        fixed = fixed.rstrip() + "."
    return {"corrected": fixed, "issues": issues, "score": max(40, 100 - 8 * len(issues)),
            "note": "Offline check: catches common mistakes only."}


def _valid_grammar(d) -> bool:
    return isinstance(d, dict) and isinstance(d.get("corrected"), str) and isinstance(d.get("issues"), list)


@router.post("/grammar/check")
async def grammar_check(req: GrammarRequest):
    prompt = (
        "Correct the grammar, spelling and clarity of the text below while keeping the writer's voice. Return JSON: "
        '{"corrected":str,"issues":[{"original":str,"suggestion":str,"explanation":str (one short sentence)}],'
        '"score":int 0-100}.\n\nText:\n' + req.text
    )
    data = await ask_json("You are a kind, precise English tutor for job seekers.", prompt,
                          lambda: _fallback_grammar(req.text), validate=_valid_grammar)
    data["score"] = max(0, min(100, int(data.get("score", 80))))
    return data


# ───────────────────────── Speaking ─────────────────────────

TOPICS = [
    {"level": "easy", "topic": "Describe your favourite place to study and why it works for you."},
    {"level": "easy", "topic": "Talk about a teacher who influenced you."},
    {"level": "easy", "topic": "Describe a hobby you would recommend to others."},
    {"level": "medium", "topic": "Should students be allowed to use AI tools for assignments?"},
    {"level": "medium", "topic": "Is working from home better than working from an office?"},
    {"level": "medium", "topic": "Tell us about a time you failed and what you learned."},
    {"level": "hard", "topic": "Will automation create more jobs than it removes?"},
    {"level": "hard", "topic": "Is a degree still necessary for a successful career?"},
    {"level": "hard", "topic": "How should companies balance profit with social responsibility?"},
]
FILLERS = ["um", "uh", "erm", "like", "you know", "basically", "actually", "literally"]


@router.get("/speaking/topic")
def speaking_topic(level: str = "medium"):
    pool = [t for t in TOPICS if t["level"] == level] or TOPICS
    return random.choice(pool)


@router.post("/speaking/feedback")
async def speaking_feedback(req: SpeakingFeedbackRequest):
    words = re.findall(r"[A-Za-z']+", req.transcript)
    wpm = round(len(words) / (req.duration_seconds / 60)) if words else 0
    lowered = " " + " ".join(w.lower() for w in words) + " "
    fillers = {f: lowered.count(f" {f} ") for f in FILLERS if lowered.count(f" {f} ")}

    def fallback():
        tips = []
        if not words:
            tips.append("No speech was captured. Check your microphone permission, or type what you said.")
        elif wpm < 100:
            tips.append("Your pace is slow. Aim for 110–160 words per minute and keep your sentences flowing.")
        elif wpm > 170:
            tips.append("You are speaking fast. Pause briefly between ideas so listeners can follow.")
        else:
            tips.append("Your pace sits in a comfortable range. Keep it up.")
        if sum(fillers.values()) > 3:
            tips.append("Replace filler words with a short silent pause. It sounds more confident.")
        tips.append("Structure your answer: opening point, two supporting examples, short conclusion.")
        return {"summary": "Here is how this attempt went.", "tips": tips}

    prompt = (
        f"Topic: {req.topic}\nTranscript: {req.transcript}\nWords per minute: {wpm}\nFillers: {fillers}\n"
        'Give feedback as JSON: {"summary":str,"tips":[str x3 concrete tips on structure, clarity and delivery]}.'
    )
    ai = await ask_json("You are a supportive public-speaking coach.", prompt, fallback,
                        validate=lambda d: isinstance(d, dict) and isinstance(d.get("tips"), list))
    return {"words": len(words), "wpm": wpm, "fillers": fillers, **ai}


# ───────────────────────── Group discussion ─────────────────────────

PANEL = [("Aarav", "supports the topic"), ("Meera", "challenges it"), ("Kabir", "looks for a balanced view")]


def _fallback_open(topic: str) -> dict:
    return {"topic": topic, "messages": [
        {"speaker": "Aarav", "text": f"I think {topic.rstrip('?.')} deserves a positive look, because the benefits are easy to see."},
        {"speaker": "Meera", "text": "I see it differently. We should not ignore the risks and who gets left behind."},
        {"speaker": "Kabir", "text": "Both points are fair. Maybe we should agree on what success looks like first."},
    ]}


@router.post("/gd/start")
async def gd_start(req: GDStart):
    topic = req.topic.strip()
    if not topic:
        topic = random.choice(["Remote work is the future of employment", "Social media does more harm than good",
                               "India should prioritise skill-based hiring over degrees"])
    prompt = (
        f"Group discussion topic: '{topic}'. Three panelists open the discussion: Aarav (supports), Meera (challenges), "
        'Kabir (balanced). Return JSON: {"messages":[{"speaker":"Aarav|Meera|Kabir","text":str (max 35 words)} x3]}.'
    )
    data = await ask_json("You simulate realistic, respectful group-discussion participants.", prompt,
                          lambda: _fallback_open(topic),
                          validate=lambda d: isinstance(d, dict) and isinstance(d.get("messages"), list) and d["messages"])
    return {"topic": topic, "messages": data["messages"]}


@router.post("/gd/turn")
async def gd_turn(req: GDTurn):
    transcript = "\n".join(f"{m.speaker}: {m.text}" for m in req.history[-12:])
    n_user = sum(1 for m in req.history if m.speaker == "You")

    def fallback():
        a, b = PANEL[n_user % 3], PANEL[(n_user + 1) % 3]
        return {"messages": [
            {"speaker": a[0], "text": "That is a useful point. Can you back it up with an example?"},
            {"speaker": b[0], "text": "Building on that, we should also consider the long-term effect, not only the short term."},
        ]}

    prompt = (
        f"Topic: {req.topic}\nDiscussion so far:\n{transcript}\nYou: {req.user_message}\n"
        "Two panelists (from Aarav, Meera, Kabir) respond to what the user just said, staying in character. "
        'Return JSON: {"messages":[{"speaker":str,"text":str (max 35 words)} x2]}.'
    )
    data = await ask_json("You simulate realistic, respectful group-discussion participants.", prompt, fallback,
                          validate=lambda d: isinstance(d, dict) and isinstance(d.get("messages"), list) and d["messages"])
    return {"messages": data["messages"]}


@router.post("/gd/evaluate")
async def gd_evaluate(req: GDEvaluate):
    mine = [m.text for m in req.history if m.speaker == "You"]

    def fallback():
        improve = []
        if len(mine) < 3:
            improve.append("Contribute more often. Aim for at least 3–4 points in a discussion.")
        if mine and sum(len(t.split()) for t in mine) / len(mine) < 15:
            improve.append("Develop each point with a reason and an example.")
        improve.append("Refer to others' points by name to show you are listening.")
        return {"score": min(90, 50 + 10 * len(mine)), "strengths": ["You took part in the discussion."] if mine else [],
                "improve": improve, "summary": f"You spoke {len(mine)} time(s)."}

    transcript = "\n".join(f"{m.speaker}: {m.text}" for m in req.history)
    prompt = (
        f"Topic: {req.topic}\n{transcript}\nEvaluate only the participant named 'You'. Return JSON: "
        '{"score":int 0-100,"strengths":[str],"improve":[str],"summary":str}.'
    )
    return await ask_json("You are a fair group-discussion evaluator.", prompt, fallback,
                          validate=lambda d: isinstance(d, dict) and "score" in d)
