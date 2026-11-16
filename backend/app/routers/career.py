import re

from fastapi import APIRouter

from ..ai import ask_json
from ..schemas import PrepRequest, Profile

router = APIRouter(prefix="/api/career", tags=["career"])

CATALOG = [
    {
        "title": "Software Developer",
        "keywords": {"python", "java", "javascript", "coding", "programming", "web", "react", "backend", "software", "apps"},
        "skills": ["Data structures and algorithms", "One backend framework", "Git and code review", "System design basics"],
        "why": "You enjoy building things with code and solving logic problems.",
    },
    {
        "title": "Data Analyst",
        "keywords": {"data", "excel", "sql", "statistics", "analysis", "python", "dashboards", "maths", "math", "numbers"},
        "skills": ["SQL", "Spreadsheet modelling", "Data visualisation", "Statistics fundamentals"],
        "why": "Your interest in numbers and patterns fits turning data into decisions.",
    },
    {
        "title": "Product Manager",
        "keywords": {"product", "strategy", "leadership", "users", "business", "management", "startup", "planning"},
        "skills": ["User research", "Roadmapping", "Metrics and experiments", "Stakeholder communication"],
        "why": "You like deciding what to build and why, not only how.",
    },
    {
        "title": "UX Designer",
        "keywords": {"design", "ux", "ui", "figma", "creative", "drawing", "art", "users", "visual"},
        "skills": ["Wireframing and prototyping", "User research", "Visual design basics", "Usability testing"],
        "why": "You have a creative eye and care about how people experience things.",
    },
    {
        "title": "Digital Marketer",
        "keywords": {"marketing", "social", "content", "writing", "seo", "brand", "media", "communication", "ads"},
        "skills": ["SEO and content strategy", "Analytics", "Paid campaigns", "Copywriting"],
        "why": "You communicate well and enjoy understanding what makes audiences respond.",
    },
    {
        "title": "Cybersecurity Analyst",
        "keywords": {"security", "hacking", "networks", "linux", "cyber", "privacy", "cryptography", "ethical"},
        "skills": ["Networking fundamentals", "Linux", "Threat modelling", "Incident response"],
        "why": "You are curious about how systems break and how to protect them.",
    },
]

ROADMAP = [
    "Month 1: Learn the fundamentals and finish one guided course.",
    "Month 2: Build a small portfolio project and publish it.",
    "Month 3: Practise interviews and mock tests weekly.",
    "Month 4: Apply for internships or entry roles and iterate on feedback.",
]


def _tokens(profile: Profile) -> set:
    blob = " ".join(profile.skills + profile.interests + [profile.goals, profile.education])
    return set(re.findall(r"[a-z+#]+", blob.lower()))


def _fallback_recommend(profile: Profile) -> dict:
    tokens = _tokens(profile)
    scored = sorted(CATALOG, key=lambda c: len(c["keywords"] & tokens), reverse=True)[:3]
    careers = []
    for c in scored:
        hits = len(c["keywords"] & tokens)
        careers.append(
            {
                "title": c["title"],
                "match": min(95, 45 + hits * 15),
                "why": c["why"],
                "skills_to_build": c["skills"],
                "roadmap": ROADMAP,
            }
        )
    return {"careers": careers}


def _valid_recommend(d) -> bool:
    return isinstance(d, dict) and isinstance(d.get("careers"), list) and len(d["careers"]) > 0 and all(
        isinstance(c, dict) and "title" in c for c in d["careers"]
    )


@router.post("/recommend")
async def recommend(profile: Profile):
    prompt = (
        "Recommend the 3 best-fitting careers for this person. Return JSON: "
        '{"careers":[{"title":str,"match":int 0-100,"why":str (1-2 sentences),'
        '"skills_to_build":[str x4],"roadmap":[str x4 short monthly steps]}]}.\n'
        f"Profile: {profile.model_dump_json()}"
    )
    data = await ask_json(
        "You are SkillPilot, a practical and encouraging career counsellor for students and early professionals.",
        prompt,
        lambda: _fallback_recommend(profile),
        validate=_valid_recommend,
    )
    for c in data["careers"]:
        c["match"] = max(0, min(100, int(c.get("match", 70))))
        c.setdefault("why", "")
        c.setdefault("skills_to_build", [])
        c.setdefault("roadmap", [])
    return data


def _fallback_prep(role: str) -> dict:
    entry = next((c for c in CATALOG if c["title"].lower() == role.lower()), None)
    skills = entry["skills"] if entry else ["Core fundamentals", "Hands-on projects", "Communication", "Problem solving"]
    return {
        "role": role,
        "overview": f"A four-week plan to get interview-ready for {role}. Adjust the pace to your schedule.",
        "topics": skills + ["Common interview questions", "Resume and portfolio"],
        "plan": [
            {"week": 1, "focus": f"Fundamentals: {skills[0]}"},
            {"week": 2, "focus": f"Build a small project using {skills[1] if len(skills) > 1 else 'your core skills'}"},
            {"week": 3, "focus": "Mock tests and a voice interview every other day"},
            {"week": 4, "focus": "Polish your resume, practise group discussions, apply"},
        ],
        "resources": [
            "Official documentation for the tools you use most",
            "One structured beginner course on a platform you trust",
            "A public project you can read and learn from",
            "A weekly study partner for mock interviews",
        ],
    }


def _valid_prep(d) -> bool:
    return isinstance(d, dict) and isinstance(d.get("topics"), list) and isinstance(d.get("plan"), list)


@router.post("/prep")
async def prep(req: PrepRequest):
    prompt = (
        f"Create interview preparation material for the role '{req.role}' at {req.level} level. Return JSON: "
        '{"role":str,"overview":str,"topics":[str x6],"plan":[{"week":int,"focus":str} x4],"resources":[str x4]}. '
        "Describe resource types, never invent URLs."
    )
    return await ask_json(
        "You are SkillPilot, a career coach who writes concrete, realistic preparation plans.",
        prompt,
        lambda: _fallback_prep(req.role),
        validate=_valid_prep,
    )
