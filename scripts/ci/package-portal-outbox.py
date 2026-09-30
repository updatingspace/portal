#!/usr/bin/env python3
"""Package the Portal worker with source and dependencies from a tested image."""

import argparse
import subprocess
import tempfile
import zipfile
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True, help="Tested Portal image@sha256:digest")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if "@sha256:" not in args.image:
        parser.error("Use an immutable image digest")
    repo = Path(__file__).resolve().parents[2]
    dependencies = subprocess.check_output(
        ["docker", "run", "--rm", "--entrypoint", "python", args.image, "-m", "pip", "freeze"],
        text=True,
    )
    requirements = "\n".join(line for line in dependencies.splitlines() if "==" in line) + "\n"
    with tempfile.TemporaryDirectory(prefix="portal-outbox-") as directory:
        source = Path(directory) / "src"
        container = subprocess.check_output(["docker", "create", args.image], text=True).strip()
        try:
            subprocess.run(["docker", "cp", f"{container}:/app/src", str(source)], check=True)
        finally:
            subprocess.run(["docker", "rm", container], check=True, stdout=subprocess.DEVNULL)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(source.rglob("*.py")):
                relative = path.relative_to(source)
                if "tests" in relative.parts or path.name.startswith("test"):
                    continue
                if str(relative) != "outbox_function.py":
                    archive.write(path, str(relative))
            archive.write(repo / "services/portal/src/outbox_function.py", "outbox_function.py")
            archive.writestr("requirements.txt", requirements)


if __name__ == "__main__":
    main()
