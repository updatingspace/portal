"""Run each Docker HTTP command with a real Gunicorn and a minimal WSGI app."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener

import pytest

ROOT = Path(__file__).resolve().parents[2]
SERVICE_PORTS = {
    "access": 8002,
    "activity": 8006,
    "bff": 8080,
    "events": 8005,
    "featureflags": 8008,
    "gamification": 8007,
    "portal": 8003,
    "voting": 8004,
}


def docker_command(service: str) -> list[str]:
    lines = (ROOT / "services" / service / "Dockerfile").read_text().splitlines()
    return json.loads(
        next(line.removeprefix("CMD ") for line in lines if line.startswith("CMD "))
    )


@pytest.fixture
def wsgi_environment(tmp_path: Path) -> dict[str, str]:
    app = tmp_path / "app"
    app.mkdir()
    (app / "__init__.py").write_text("")
    (app / "wsgi.py").write_text(
        "def application(environ, start_response):\n"
        '    start_response("200 OK", [("Content-Type", "text/plain")])\n'
        '    return [b"runtime port ready"]\n'
    )
    env = os.environ.copy()
    env.pop("PORT", None)
    env.pop("GUNICORN_CMD_ARGS", None)
    env["PYTHONPATH"] = str(tmp_path)
    env["XDG_RUNTIME_DIR"] = str(tmp_path)
    env["PATH"] = str(Path(sys.executable).parent) + os.pathsep + env.get("PATH", "")
    return env


@pytest.mark.parametrize("service", SERVICE_PORTS)
def test_http_command_serves_assigned_port(
    service: str, tmp_path: Path, wsgi_environment: dict[str, str]
) -> None:
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    env = {**wsgi_environment, "PORT": str(port)}
    opener = build_opener(ProxyHandler({}))
    with (tmp_path / "gunicorn.log").open("w+") as log:
        process = subprocess.Popen(
            docker_command(service), cwd=tmp_path, env=env, stdout=log, stderr=log
        )
        try:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline and process.poll() is None:
                try:
                    with opener.open(
                        f"http://127.0.0.1:{port}/health", timeout=0.2
                    ) as response:
                        assert response.status == 200
                        assert response.read() == b"runtime port ready"
                    break
                except (URLError, TimeoutError):
                    time.sleep(0.02)
            else:
                log.seek(0)
                pytest.fail(
                    f"{service} did not serve assigned PORT={port}:\n{log.read()}"
                )
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        # The shell must exec Gunicorn so termination reaches the master.
        assert process.returncode == 0


@pytest.mark.parametrize("service,port", SERVICE_PORTS.items())
@pytest.mark.parametrize("port_value", [None, ""])
def test_http_command_keeps_local_default_port(
    service: str,
    port: int,
    port_value: str | None,
    tmp_path: Path,
    wsgi_environment: dict[str, str],
) -> None:
    env = {**wsgi_environment, "GUNICORN_CMD_ARGS": "--print-config"}
    if port_value is not None:
        env["PORT"] = port_value
    result = subprocess.run(
        docker_command(service),
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
        check=True,
    )
    bind = next(
        line.split("=", 1)[1].strip()
        for line in result.stdout.splitlines()
        if line.startswith("bind ")
    )
    assert bind == repr([f"0.0.0.0:{port}"])
