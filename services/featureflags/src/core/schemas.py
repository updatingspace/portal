from __future__ import annotations

from ninja import Schema
from pydantic import ConfigDict


def _to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CamelSchema(Schema):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)
