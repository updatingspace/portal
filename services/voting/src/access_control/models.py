from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class _SimpleManager:
    def __init__(self, model: type):
        self._model = model
        self._instances: list[Any] = []

    def get_or_create(self, defaults: dict | None = None, **kwargs):
        obj = self._model(**kwargs, **(defaults or {}))
        self._instances.append(obj)
        return obj, True

    def create(self, **kwargs):
        obj = self._model(**kwargs)
        self._instances.append(obj)
        return obj


class PermissionService:
    VOTING = "VOTING"


@dataclass(slots=True)
class Permission:
    key: str
    description: str
    service: str


@dataclass(slots=True)
class Role:
    tenant_id: str
    service: str
    name: str


@dataclass(slots=True)
class RolePermission:
    role: Role
    permission_id: str


@dataclass(slots=True)
class RoleBinding:
    tenant_id: str
    user_id: str
    scope_type: str
    scope_id: str
    role: Role


Permission.objects = _SimpleManager(Permission)
Role.objects = _SimpleManager(Role)
RolePermission.objects = _SimpleManager(RolePermission)
RoleBinding.objects = _SimpleManager(RoleBinding)
