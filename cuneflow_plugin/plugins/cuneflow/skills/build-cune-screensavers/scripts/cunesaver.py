#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path


def _repository_root() -> Path | None:
    for candidate in Path(__file__).resolve().parents:
        if (candidate / "pyproject.toml").is_file():
            return candidate
    return None


repository_root = _repository_root()
if repository_root is None:
    candidates = [Path(__file__).resolve().with_name("cunesaver.pyz")]
    candidates.extend(
        candidate / "tools/cunesaver.pyz" for candidate in Path(__file__).resolve().parents
    )
    for bundled_cli in candidates:
        if bundled_cli.is_file():
            os.execv(
                sys.executable,
                [sys.executable, str(bundled_cli), *sys.argv[1:]],
            )
    raise RuntimeError("Cune Screensaver SDK repository root or bundled CLI was not found")

sys.path.insert(0, str(repository_root / "src"))

from cunesaver.cli import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())
