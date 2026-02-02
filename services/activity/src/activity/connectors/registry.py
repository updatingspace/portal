from __future__ import annotations

from ninja.errors import HttpError

from activity.connectors.base import Connector
from core.errors import error_payload


_CONNECTORS: dict[str, Connector] = {}


def register_connector(connector: Connector) -> None:
    _CONNECTORS[connector.type] = connector


def get_connector(source_type: str) -> Connector:
    c = _CONNECTORS.get(source_type)
    if not c:
        raise HttpError(
            400,
            error_payload(
                "UNKNOWN_CONNECTOR",
                f"No connector registered for source type '{source_type}'",
            ),
        )
    return c


def list_connectors() -> list[Connector]:
    return list(_CONNECTORS.values())
