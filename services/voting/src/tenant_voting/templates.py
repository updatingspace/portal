from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Iterable

from .models import PollVisibility


@dataclass(slots=True)
class TemplateQuestion:
    title: str
    description: str = ""
    kind: str = "custom"
    max_votes: int = 1
    is_required: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "description": self.description,
            "kind": self.kind,
            "max_votes": self.max_votes,
            "is_required": self.is_required,
        }


@dataclass(slots=True)
class PollTemplate:
    slug: str
    title: str
    description: str
    visibility: str
    settings: dict[str, Any]
    questions: list[TemplateQuestion]

    def to_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "title": self.title,
            "description": self.description,
            "visibility": self.visibility,
            "settings": self.settings,
            "questions": [question.to_dict() for question in self.questions],
        }


_TEMPLATES: tuple[PollTemplate, ...] = (
    PollTemplate(
        slug="quick",
        title="Быстрый опрос",
        description="Один вопрос и один выбор.",
        visibility=PollVisibility.PUBLIC,
        settings={"results_visibility": "always", "allow_revoting": False},
        questions=[TemplateQuestion(title="Вопрос", is_required=True)],
    ),
    PollTemplate(
        slug="multi",
        title="Множественный выбор",
        description="Один вопрос с несколькими вариантами.",
        visibility=PollVisibility.PUBLIC,
        settings={"results_visibility": "after_closed", "allow_revoting": True},
        questions=[TemplateQuestion(title="Вопрос", max_votes=3)],
    ),
    PollTemplate(
        slug="survey",
        title="Анкета",
        description="Несколько вопросов с единственным выбором.",
        visibility=PollVisibility.PUBLIC,
        settings={"results_visibility": "after_closed"},
        questions=[
            TemplateQuestion(title="Вопрос 1", is_required=True),
            TemplateQuestion(title="Вопрос 2"),
        ],
    ),
    PollTemplate(
        slug="awards",
        title="Номинации",
        description="Категории как в наградах.",
        visibility=PollVisibility.PUBLIC,
        settings={"results_visibility": "after_closed"},
        questions=[
            TemplateQuestion(title="Лучшая игра года"),
            TemplateQuestion(title="Лучшая инди-игра"),
        ],
    ),
    PollTemplate(
        slug="schedule",
        title="Голосование за даты",
        description="Несколько вариантов дат, можно выбрать до 5.",
        visibility=PollVisibility.PUBLIC,
        settings={"results_visibility": "always", "allow_revoting": True},
        questions=[TemplateQuestion(title="Удобная дата", max_votes=5)],
    ),
)


def get_templates() -> list[dict[str, Any]]:
    return [template.to_dict() for template in _TEMPLATES]


def get_template(slug: str) -> dict[str, Any] | None:
    for template in _TEMPLATES:
        if template.slug == slug:
            return template.to_dict()
    return None
