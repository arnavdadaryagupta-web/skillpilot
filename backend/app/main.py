from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .ai import ai_enabled
from .config import CORS_ORIGINS
from .routers import career, interview, practice

app = FastAPI(title="SkillPilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(career.router)
app.include_router(practice.router)
app.include_router(interview.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "SkillPilot", "ai_enabled": ai_enabled()}
