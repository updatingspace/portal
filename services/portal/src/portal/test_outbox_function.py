from unittest import mock

import pytest

from outbox_function import handler


@mock.patch("outbox_function.connections.close_all")
@mock.patch("outbox_function.django.setup")
@mock.patch("outbox_function.call_command")
def test_sweep_ignores_invocation_payload(command, setup, close):
    def process(*args, **kwargs):
        kwargs["stdout"].write("Processed 1 tenant provisioning events\n")

    command.side_effect = process
    response = handler({"limit": 999999, "approve": "unapproved", "user_id": "spoof"}, None)
    assert response == {
        "statusCode": 200,
        "body": "Processed 1 tenant provisioning events",
    }
    command.assert_called_once_with("process_outbox", limit=10, stdout=mock.ANY)
    close.assert_called_once()


@mock.patch("outbox_function.connections.close_all")
@mock.patch("outbox_function.django.setup")
@mock.patch("outbox_function.call_command", side_effect=RuntimeError("YDB unavailable"))
def test_failed_sweep_is_retryable_and_closes_connections(command, setup, close):
    with pytest.raises(RuntimeError, match="YDB unavailable"):
        handler({}, None)
    close.assert_called_once()
