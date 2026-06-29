from __future__ import annotations

import sys
import types
from unittest.mock import patch

from app import cloud_runtime


def _install_fake_ydb_backend(version):
    base_module = types.ModuleType("ydb_backend.backend.base")

    class FakeDatabaseWrapper:
        def get_database_version(self):
            return version

    base_module.DatabaseWrapper = FakeDatabaseWrapper

    backend_module = types.ModuleType("ydb_backend.backend")
    backend_module.base = base_module

    root_module = types.ModuleType("ydb_backend")
    root_module.backend = backend_module

    return {
        "ydb_backend": root_module,
        "ydb_backend.backend": backend_module,
        "ydb_backend.backend.base": base_module,
    }


def test_patch_ydb_version_check_normalizes_string_versions():
    fake_modules = _install_fake_ydb_backend("25.1.4.0")

    with patch.dict(sys.modules, fake_modules, clear=False):
        cloud_runtime._patch_ydb_version_check()

        wrapper = fake_modules["ydb_backend.backend.base"].DatabaseWrapper()
        assert wrapper.get_database_version() == (25, 1, 4, 0)


def test_patch_ydb_version_check_strips_non_numeric_suffixes():
    fake_modules = _install_fake_ydb_backend(("25", "1", "4-hotfix", "build-9"))

    with patch.dict(sys.modules, fake_modules, clear=False):
        cloud_runtime._patch_ydb_version_check()

        wrapper = fake_modules["ydb_backend.backend.base"].DatabaseWrapper()
        assert wrapper.get_database_version() == (25, 1, 4, 9)
