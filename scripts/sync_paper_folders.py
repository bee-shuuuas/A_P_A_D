#!/usr/bin/env python3
"""Create stable workspace folders for papers listed in data/papers.json."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PAPERS_JSON = ROOT / "data" / "papers.json"
PAPERS_DIR = ROOT / "papers"
MANIFEST = PAPERS_DIR / "manifest.json"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create numbered paper workspace folders from data/papers.json."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be created without writing files.",
    )
    args = parser.parse_args()

    papers = read_papers()
    manifest = read_manifest()
    next_number = find_next_number(manifest)
    changed = False

    for paper in papers:
        paper_id = str(paper.get("id", "")).strip()
        title = str(paper.get("title", "")).strip()

        if not paper_id or not title:
            print("Skipping a paper without both id and title.")
            continue

        if paper_id not in manifest:
            folder_name = make_folder_name(next_number, title or paper_id)
            while folder_name in manifest.values() or (PAPERS_DIR / folder_name).exists():
                next_number += 1
                folder_name = make_folder_name(next_number, title or paper_id)

            manifest[paper_id] = folder_name
            next_number += 1
            changed = True

        folder = PAPERS_DIR / manifest[paper_id]
        print(f"{paper_id} -> {folder.relative_to(ROOT)}")

        if not args.dry_run:
            create_workspace(folder, paper)

    if changed and not args.dry_run:
        PAPERS_DIR.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    if args.dry_run and changed:
        print("Manifest would be updated with new paper folders.")

    return 0


def read_papers() -> list[dict[str, Any]]:
    if not PAPERS_JSON.exists():
        raise SystemExit(f"Missing {PAPERS_JSON.relative_to(ROOT)}")

    data = json.loads(PAPERS_JSON.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("data/papers.json must contain a JSON array.")

    papers: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            papers.append(item)
    return papers


def read_manifest() -> dict[str, str]:
    if not MANIFEST.exists():
        return {}

    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit("papers/manifest.json must contain a JSON object.")

    return {str(key): str(value) for key, value in data.items()}


def find_next_number(manifest: dict[str, str]) -> int:
    highest = 0
    for folder_name in manifest.values():
        match = re.match(r"^(\d+)-", folder_name)
        if match:
            highest = max(highest, int(match.group(1)))

    if PAPERS_DIR.exists():
        for path in PAPERS_DIR.iterdir():
            if path.is_dir():
                match = re.match(r"^(\d+)-", path.name)
                if match:
                    highest = max(highest, int(match.group(1)))

    return highest + 1


def make_folder_name(number: int, title: str) -> str:
    return f"{number:03d}-{slugify(title)}"


def create_workspace(folder: Path, paper: dict[str, Any]) -> None:
    folder.mkdir(parents=True, exist_ok=True)

    write_if_missing(folder / "README.md", render_readme(paper))
    write_if_missing(folder / "notes.md", render_notes(paper))


def write_if_missing(path: Path, content: str) -> None:
    if path.exists():
        return
    path.write_text(content, encoding="utf-8")


def render_readme(paper: dict[str, Any]) -> str:
    title = str(paper.get("title", "Untitled paper"))
    authors = str(paper.get("authors", ""))
    venue = str(paper.get("venue", ""))
    link = str(paper.get("link", ""))
    pdf = str(paper.get("pdf", ""))
    tags = paper.get("tags", [])
    tag_text = ", ".join(tags) if isinstance(tags, list) else str(tags)
    summary = str(paper.get("summary", ""))

    return f"""# {title}

## Paper

- Authors: {authors}
- Venue: {venue}
- Tags: {tag_text}
- Link: {link}
- PDF: {pdf}

## Summary

{summary}

## Reading Checklist

- [ ] Read abstract and introduction
- [ ] Skim figures and method
- [ ] Read experiments/results
- [ ] Write key takeaways
- [ ] Add follow-up ideas

## Files

- `notes.md`: detailed reading notes
"""


def render_notes(paper: dict[str, Any]) -> str:
    title = str(paper.get("title", "Untitled paper"))
    return f"""# Notes: {title}

## One-sentence takeaway


## Problem


## Method


## Results


## Strengths


## Weaknesses / Questions


## Ideas to Try


## Related Papers

"""


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:72] or "paper"


if __name__ == "__main__":
    raise SystemExit(main())
