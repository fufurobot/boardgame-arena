#!/usr/bin/env python3
"""Reusable GitHub API client (sandbox-safe: uses python urllib, not curl).

Usage:
  echo '{"title":"x","body":"y"}' | python3 scripts/gh.py POST /repos/O/R/issues
  python3 scripts/gh.py GET /repos/O/R/issues/1
  python3 scripts/gh.py GET /repos/O/R --raw
"""
import json
import os
import sys

API = "https://api.github.com"


def load_token():
    tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if tok:
        return tok.strip()
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    try:
        with open(env_path) as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("GITHUB_TOKEN="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return None


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    method, path = sys.argv[1].upper(), sys.argv[2]
    raw = "--raw" in sys.argv
    payload = None
    if method in ("POST", "PATCH", "PUT", "DELETE"):
        data = sys.stdin.read().strip()
        payload = json.loads(data) if data else None

    token = load_token()
    if not token:
        print("ERROR: no GITHUB_TOKEN found (env or .env)", file=sys.stderr)
        return 1

    import urllib.error
    import urllib.request

    url = path if path.startswith("http") else API + path
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "fbg-dsh-agent")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode()
            print("HTTP", resp.status, file=sys.stderr)
            print(text if raw else json.dumps(json.loads(text), indent=2))
            return 0
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        print(f"HTTP {e.code} {e.reason}", file=sys.stderr)
        print(detail, file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
