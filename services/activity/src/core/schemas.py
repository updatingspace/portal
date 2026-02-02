
from __future__ import annotations
from ninja import Schema
from pydantic import ConfigDict

def _to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])

class CamelSchema(Schema):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)

class FieldErrorItem(Schema):
    message: str
    code: str | None = None

class ErrorOut(Schema):
    code: str
    message: str
    details: dict | None = None
    errors: dict[str, list[FieldErrorItem]] | None = None
    fields: dict[str, str] | None = None
    detail: str | None = None
    status: int | None = None

