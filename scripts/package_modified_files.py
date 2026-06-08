from __future__ import annotations

from pathlib import Path

import py7zr


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "修改檔.7z"

FILES = [
    "README.md",
    "README_EN.md",
    "start.cmd",
    "frontend/src/App.tsx",
    "frontend/src/components/ActiveTaskBanner.tsx",
    "frontend/src/components/AppShell.tsx",
    "frontend/src/components/ConfirmDialog.tsx",
    "frontend/src/components/Sidebar.tsx",
    "frontend/src/components/Topbar.tsx",
    "frontend/src/pages/HomePage.tsx",
    "frontend/src/pages/SettingsPage.tsx",
    "frontend/src/types/api.ts",
    "frontend/src/utils/i18n.ts",
    "frontend/src/utils/preferences.ts",
    "frontend/src/utils/taskLabels.ts",
    "tests/test_agent.py",
    "tests/test_config.py",
    "tests/test_report.py",
    "vulnclaw/agent/core.py",
    "vulnclaw/agent/prompt_context.py",
    "vulnclaw/agent/prompts.py",
    "vulnclaw/cli/main.py",
    "vulnclaw/cli/tui.py",
    "vulnclaw/config/schema.py",
    "vulnclaw/config/settings.py",
    "vulnclaw/report/generator.py",
    "vulnclaw/web/schemas.py",
    "vulnclaw/web/services/config_service.py",
    "scripts/package_modified_files.py",
    "修改vulnclaw.md",
]


def main() -> None:
    if ARCHIVE.exists():
        ARCHIVE.unlink()

    missing = [item for item in FILES if not (ROOT / item).exists()]
    if missing:
        raise FileNotFoundError(f"Missing files: {missing}")

    with py7zr.SevenZipFile(ARCHIVE, "w") as archive:
        for item in FILES:
            archive.write(ROOT / item, item)

    print(f"Created {ARCHIVE}")
    print(f"Packed {len(FILES)} files")


if __name__ == "__main__":
    main()
