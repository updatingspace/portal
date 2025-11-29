from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserSchema(BaseModel):
    id: int
    username: str
    email: EmailStr | None = None


class SessionSchema(BaseModel):
    session_key: str
    is_current: bool
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime | None = None
    last_seen_at: datetime | None = None
    expires_at: datetime


class AuthResponseSchema(BaseModel):
    user: UserSchema
    session: SessionSchema


class ProfileResponseSchema(BaseModel):
    user: UserSchema
    sessions: list[SessionSchema]


class LoginRequestSchema(BaseModel):
    login: str = Field(..., min_length=2, max_length=150)
    password: str = Field(..., min_length=8, max_length=128)


class RegisterRequestSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    password_confirm: str = Field(..., min_length=8, max_length=128)
