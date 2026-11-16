from typing import List, Optional

from pydantic import BaseModel, Field


class Profile(BaseModel):
    name: str = Field("", max_length=80)
    education: str = Field("", max_length=120)
    skills: List[str] = []
    interests: List[str] = []
    experience_level: str = "student"
    goals: str = Field("", max_length=600)


class PrepRequest(BaseModel):
    role: str = Field(..., min_length=2, max_length=80)
    level: str = "beginner"


class TestRequest(BaseModel):
    role: str = Field("general", max_length=80)
    topic: str = Field("aptitude", max_length=80)
    count: int = Field(5, ge=1, le=15)


class TestSubmit(BaseModel):
    answers: List[Optional[int]]


class GrammarRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class SpeakingFeedbackRequest(BaseModel):
    topic: str = Field(..., max_length=200)
    transcript: str = Field(..., max_length=6000)
    duration_seconds: float = Field(..., gt=0, le=3600)


class GDMessage(BaseModel):
    speaker: str = Field(..., max_length=40)
    text: str = Field(..., max_length=1500)


class GDStart(BaseModel):
    topic: str = Field("", max_length=200)


class GDTurn(BaseModel):
    topic: str = Field(..., max_length=200)
    history: List[GDMessage] = []
    user_message: str = Field(..., min_length=1, max_length=1500)


class GDEvaluate(BaseModel):
    topic: str = Field(..., max_length=200)
    history: List[GDMessage]
