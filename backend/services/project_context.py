"""Project context extraction — reads conventions from the working directory."""

from __future__ import annotations

import json
import os


def build_project_context(work_dir: str) -> str:
    """Build a project context block from conventions files in work_dir.

    Reads CLAUDE.md, README.md, package.json, and pyproject.toml (with graceful
    failure) and returns a formatted ## Project Context block, or empty string.
    """
    sections: list[str] = []

    # CLAUDE.md — project conventions (first 5000 chars)
    claude_md = _read_file(os.path.join(work_dir, "CLAUDE.md"), 5000)
    if claude_md:
        sections.append(f"### CLAUDE.md (Project Conventions)\n{claude_md}")

    # README.md — project overview (first 2000 chars)
    readme = _read_file(os.path.join(work_dir, "README.md"), 2000)
    if readme:
        sections.append(f"### README.md (Overview)\n{readme}")

    # package.json — scripts + key dependencies
    pkg_json = _read_package_json(os.path.join(work_dir, "package.json"))
    if pkg_json:
        sections.append(f"### package.json (Key Info)\n{pkg_json}")

    # pyproject.toml — Python project config (first 3000 chars)
    pyproject = _read_file(os.path.join(work_dir, "pyproject.toml"), 3000)
    if pyproject:
        sections.append(f"### pyproject.toml\n{pyproject}")

    if not sections:
        return ""

    return "## Project Context\n\n" + "\n\n".join(sections)


def _read_file(path: str, max_chars: int) -> str:
    """Read a file up to max_chars, returning empty string on failure."""
    try:
        with open(path, encoding="utf-8") as f:
            return f.read(max_chars)
    except (OSError, UnicodeDecodeError):
        return ""


def _read_package_json(path: str) -> str:
    """Extract scripts and key dependency names from package.json."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return ""

    parts: list[str] = []
    scripts = data.get("scripts")
    if scripts:
        parts.append("**Scripts:** " + ", ".join(f"`{k}`: {v}" for k, v in scripts.items()))

    for dep_key in ("dependencies", "devDependencies"):
        deps = data.get(dep_key)
        if deps:
            parts.append(f"**{dep_key}:** " + ", ".join(sorted(deps.keys())))

    return "\n".join(parts) if parts else ""
