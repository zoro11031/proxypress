#!/usr/bin/env python3
"""Sync GitHub releases to minimal 0.x.x versioning scheme and notes."""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
REPO = os.environ.get("GITHUB_REPOSITORY", "zoro11031/proxypress")

if not TOKEN:
    print("Error: GH_TOKEN or GITHUB_TOKEN environment variable required.")
    sys.exit(1)

HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {TOKEN}",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "proxypress-sync-releases"
}

RELEASES_MAP = {
    "v0.5.1": {
        "tag_name": "v0.5.1",
        "name": "Proxy Press v0.5.1",
        "target_commitish": "c31b33e",
        "make_latest": "true"
    },
    "v0.5.0": {
        "tag_name": "v0.5.0",
        "name": "Proxy Press v0.5.0",
        "target_commitish": "3e80511",
        "make_latest": "false"
    },
    "v0.4.0": {
        "tag_name": "v0.4.0",
        "name": "Proxy Press v0.4.0",
        "target_commitish": "39a768a",
        "body": (
            "# Proxy Press v0.4.0\n\n"
            "- **Public deck sharing:** Share decks via public, revocable links with deduplicated server storage.\n"
            "- **Instance art library:** Uploaded artwork matched to cards is indexed and searchable across the instance.\n"
            "- **Scryfall art search:** Browse and select official Scryfall printings alongside community art.\n"
            "- **Compact JSON export:** Export decks with compressed artwork and links to original server assets."
        ),
        "draft": False,
        "make_latest": "false"
    },
    "v0.3.3": {
        "tag_name": "v0.3.3",
        "name": "Proxy Press v0.3.3",
        "target_commitish": "1ef70e4",
        "body": (
            "# Proxy Press v0.3.3\n\n"
            "- **Layer ordering:** Sheet cut lines and outlines render strictly under cards; only corner marks render on top.\n"
            "- **Dropdown controls:** Restored corner shape and placement selector options."
        )
    },
    "v0.3.2": {
        "tag_name": "v0.3.2",
        "name": "Proxy Press v0.3.2",
        "target_commitish": "0f32c95",
        "body": (
            "# Proxy Press v0.3.2\n\n"
            "- **Guide specs:** Proxxied 0.25 mm line thickness and colorblind-safe guide palettes."
        )
    },
    "v0.3.1": {
        "tag_name": "v0.3.1",
        "name": "Proxy Press v0.3.1",
        "target_commitish": "52f24cc",
        "body": (
            "# Proxy Press v0.3.1\n\n"
            "- **Layered guides:** Combination guide toggle and All preset."
        )
    },
    "v0.3.0": {
        "tag_name": "v0.3.0",
        "name": "Proxy Press v0.3.0",
        "target_commitish": "7eb3702",
        "body": (
            "# Proxy Press v0.3.0\n\n"
            "- **Cut guides:** Continuous sheet lines, custom cut/corner colors, and dark workspace."
        )
    },
    "v0.2.0": {
        "tag_name": "v0.2.0",
        "name": "Proxy Press v0.2.0",
        "target_commitish": "8021f0a",
        "body": (
            "# Proxy Press v0.2.0\n\n"
            "- **Deck suggestions:** EDHREC suggestions for Commander and constructed decks.\n"
            "- **Token faces:** Support for selecting specific faces on tokens and double-faced cards."
        )
    },
    "v0.1.2": {
        "tag_name": "v0.1.2",
        "name": "Proxy Press v0.1.2",
        "target_commitish": "7dec04a",
        "body": (
            "# Proxy Press v0.1.2\n\n"
            "- **Workflow fixes:** Tour navigation, deck import boards, and export button fixes."
        )
    },
    "v0.1.1": {
        "tag_name": "v0.1.1",
        "name": "Proxy Press v0.1.1",
        "target_commitish": "013e928",
        "body": (
            "# Proxy Press v0.1.1\n\n"
            "- **Polish:** Brand icon redesign, dark warning styles, and window bounds fixes."
        )
    },
    "v0.1.0": {
        "tag_name": "v0.1.0",
        "name": "Proxy Press v0.1.0",
        "target_commitish": "8817318",
        "body": (
            "# Proxy Press v0.1.0\n\n"
            "- **Initial release:** Desktop application packaging for Windows (.exe/.msi) and Linux (.AppImage, .deb, .rpm, .pacman, AUR)."
        )
    }
}


def api_request(method, path, data=None):
    url = f"https://api.github.com/repos/{REPO}{path}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return None
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        print(f"HTTP {e.code} on {method} {path}: {err_msg}", file=sys.stderr)
        raise


def sync():
    print(f"Fetching releases for {REPO}...")
    releases = api_request("GET", "/releases?per_page=100")
    print(f"Found {len(releases)} releases.")
    existing_tags = {r.get("tag_name") for r in releases}

    # Ensure v0.4.0 release is created if missing
    if "v0.4.0" not in existing_tags:
        print("Creating release for v0.4.0...")
        info = RELEASES_MAP["v0.4.0"]
        proc = subprocess.run(
            ["gh", "release", "create", "v0.4.0", "--repo", REPO, "--title", info["name"], "--notes", info["body"]],
            capture_output=True,
            text=True
        )
        print(f"  gh release create result: rc={proc.returncode}")
        if proc.stdout:
            print(f"  stdout: {proc.stdout.strip()}")
        if proc.stderr:
            print(f"  stderr: {proc.stderr.strip()}")
        if proc.returncode == 0:
            existing_tags.add("v0.4.0")

    for r in releases:
        tag = r.get("tag_name")
        rel_id = r.get("id")

        target_info = RELEASES_MAP.get(tag)
        if not target_info:
            for info in RELEASES_MAP.values():
                if info["tag_name"] == tag:
                    target_info = info
                    break

        if target_info:
            print(f"Updating release {rel_id} ({tag} -> {target_info['name']})...")
            payload = {
                "name": target_info["name"],
                "draft": target_info.get("draft", False),
                "make_latest": target_info.get("make_latest", "false")
            }
            if "body" in target_info:
                payload["body"] = target_info["body"]

            try:
                updated = api_request("PATCH", f"/releases/{rel_id}", payload)
                print(f"  ✓ Updated {updated.get('tag_name')} - {updated.get('name')}")
            except Exception as e:
                print(f"  Error updating release {rel_id}: {e}")

    print("Sync complete.")


if __name__ == "__main__":
    sync()
