#!/usr/bin/env python3
"""Validate curriculum release files and report official source availability.

This monitor does not copy, rewrite, or publish textbook content. A source change
creates a review signal; a human must verify the new edition before approval.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "public/primary-curriculum-sources-2026-2027.json"
SCHEMA = ROOT / "schemas/curriculum-release.schema.json"
RELEASES = ROOT / "curriculum/releases"


def emit(message: str) -> None:
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(message + "\n")
    print(message)


def check_url(url: str) -> tuple[str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "FuturePlatform-CurriculumMonitor/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read(2_000_000)
            return str(response.status), hashlib.sha256(body).hexdigest()
    except urllib.error.HTTPError as error:
        return f"HTTP_{error.code}", ""
    except Exception as error:  # network failures should be visible in the report
        return f"ERROR_{type(error).__name__}", ""


def validate_release(data: dict, path: Path, schema: dict) -> list[str]:
    errors = []
    required = schema["required"]
    for key in required:
        if key not in data:
            errors.append(f"{path}: missing {key}")
    if data.get("status") in {"approved", "published"}:
        review = data.get("review") or {}
        if not review.get("reviewerId") or not review.get("reviewedAt"):
            errors.append(f"{path}: approved/published release requires reviewerId and reviewedAt")
        if not data.get("source", {}).get("url") or not data.get("source", {}).get("edition"):
            errors.append(f"{path}: approved/published release requires source URL and edition")
    for unit in data.get("units", []):
        if not unit.get("lessons"):
            errors.append(f"{path}: unit {unit.get('unitId')} has no lessons")
        for lesson in unit.get("lessons", []):
            if not lesson.get("explanation") or not lesson.get("objectives") or not lesson.get("practice"):
                errors.append(f"{path}: lesson {lesson.get('lessonId')} needs objectives, explanation and practice")
    return errors


def main() -> int:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    emit("# Curriculum source monitor")
    emit(f"- Checked: {dt.datetime.now(dt.timezone.utc).isoformat()}")
    emit(f"- Registry: {registry.get('schoolYear', 'unknown')}")
    urls = []
    for system in registry.get("systems", []):
        for key in ("officialPortal", "officialBooksPortal", "officialPlanPortal"):
            url = system.get(key)
            if url and url not in urls:
                urls.append(url)
    for url in (registry.get("officialPortal"), registry.get("azharPortal"), registry.get("azharBooksPortal")):
        if url and url not in urls:
            urls.append(url)
    emit("| Official source | Status | Response SHA-256 |")
    emit("|---|---:|---|")
    for url in urls:
        status, digest = check_url(url)
        emit(f"| {url} | {status} | {digest or 'not available'} |")
    errors = []
    if RELEASES.exists():
        for path in sorted(RELEASES.rglob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                errors.extend(validate_release(data, path.relative_to(ROOT), schema))
            except Exception as error:
                errors.append(f"{path.relative_to(ROOT)}: {error}")
    else:
        emit("- No curriculum releases exist yet; no lessons or exams are being represented as complete.")
    if errors:
        emit("## Validation errors")
        for error in errors:
            emit(f"- {error}")
        return 1
    emit("- Release structure validation: passed")
    emit("- Publication remains blocked until a reviewer explicitly approves the release.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
