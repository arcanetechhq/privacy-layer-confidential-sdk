#!/usr/bin/env bash
# Plan (and optionally apply) the privacy SDK Stellar package release for a release line.
# DRY_RUN=1: print the plan, pack the Stellar package, perform no publish side effects.
# DRY_RUN=0: print the same plan, write the selected version into package.json,
#            and leave tagging / npm publish to the caller.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_JSON="$ROOT/packages/stellar/package.json"
ZK_SDK_DEP="@arcanetech/stellar-privacy-pool-zk-sdk"
EXPECTED_ZK_RANGE=">=0.11.0 <1.0.0"
LINE_0_MANIFEST="stellar/v0/circuits-manifest.json"

DRY_RUN="${DRY_RUN:-1}"
RELEASE_LINE="${RELEASE_LINE:-}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-}"

if [[ "$DRY_RUN" != "0" && "$DRY_RUN" != "1" ]]; then
  echo "DRY_RUN must be 0 or 1" >&2
  exit 1
fi

if [[ -z "$RELEASE_LINE" ]]; then
  echo "RELEASE_LINE is required" >&2
  exit 1
fi

if [[ -z "$COMMIT_MESSAGE" ]]; then
  echo "COMMIT_MESSAGE is required" >&2
  exit 1
fi

if [[ "$RELEASE_LINE" != "0" ]]; then
  echo "RELEASE_LINE=${RELEASE_LINE} is not supported yet" >&2
  exit 1
fi

current_version="$(python3 -c 'import json; print(json.load(open("'"$PACKAGE_JSON"'"))["version"])')"
current_zk_range="$(
  PACKAGE_JSON="$PACKAGE_JSON" ZK_SDK_DEP="$ZK_SDK_DEP" python3 - <<'PY'
import json
import os

data = json.load(open(os.environ["PACKAGE_JSON"], encoding="utf-8"))
deps = data.get("dependencies") or {}
print(deps.get(os.environ["ZK_SDK_DEP"]) or "")
PY
)"

if [[ "$current_zk_range" != "$EXPECTED_ZK_RANGE" ]]; then
  echo "Stellar package zk SDK range must be ${EXPECTED_ZK_RANGE}, found: ${current_zk_range}" >&2
  exit 1
fi

PLAN_FILE="$(mktemp)"
trap 'rm -f "$PLAN_FILE"' EXIT

COMMIT_MESSAGE="$COMMIT_MESSAGE" \
CURRENT_VERSION="$current_version" \
RELEASE_LINE="$RELEASE_LINE" \
LINE_0_MANIFEST="$LINE_0_MANIFEST" \
PLAN_FILE="$PLAN_FILE" \
python3 - <<'PY'
import json
import os
import re
import sys

message = os.environ["COMMIT_MESSAGE"]
version = os.environ["CURRENT_VERSION"]
release_line = os.environ["RELEASE_LINE"]
line_0_manifest = os.environ["LINE_0_MANIFEST"]
plan_file = os.environ["PLAN_FILE"]

breaking = bool(re.search(r"^(\w+)(\(.+\))?!:", message, re.M)) or (
    "BREAKING CHANGE:" in message
)

def parse_semver(raw: str):
    base = re.sub(r"[-+].*$", "", raw)
    parts = [int(p) for p in base.split(".")]
    if len(parts) != 3:
        print(f"unsupported version: {raw}", file=sys.stderr)
        sys.exit(1)
    return parts[0], parts[1], parts[2]

def commit_kind(msg: str) -> str:
    first = msg.split("\n", 1)[0]
    kind_match = re.match(r"^(\w+)(\(.+\))?!?:", first)
    return kind_match.group(1) if kind_match else ""

def write_plan(next_version: str | None, dist_tags: str | None, manifest: str, breaking_verdict: str):
    plan = {
        "version": next_version,
        "distTags": dist_tags.split() if dist_tags else [],
        "circuitsManifest": manifest,
        "breakingCommit": breaking_verdict,
    }
    with open(plan_file, "w", encoding="utf-8") as handle:
        json.dump(plan, handle)
        handle.write("\n")

if release_line == "0":
    if breaking:
        write_plan(None, None, line_0_manifest, "refuse")
        print("breaking-commit: refuse")
        print(f"circuits-manifest: {line_0_manifest}")
        print("protected-path: allow")
        sys.exit(1)

    major, minor, patch = parse_semver(version)
    kind = commit_kind(message)
    if kind == "feat":
        minor += 1
        patch = 0
    elif kind == "fix":
        patch += 1
    else:
        print(f"unsupported commit type in message: {message!r}", file=sys.stderr)
        sys.exit(1)

    next_version = f"{major}.{minor}.{patch}"
    dist_tags = "v0 latest"
    write_plan(next_version, dist_tags, line_0_manifest, "allow")
    print(f"version: {next_version}")
    print(f"dist-tags: {dist_tags}")
    print(f"circuits-manifest: {line_0_manifest}")
    print("breaking-commit: allow")
    print("protected-path: allow")
    sys.exit(0)

print(f"RELEASE_LINE={release_line} is not supported yet", file=sys.stderr)
sys.exit(1)
PY

if [[ "$DRY_RUN" == "0" ]]; then
  PACKAGE_JSON="$PACKAGE_JSON" PLAN_FILE="$PLAN_FILE" python3 - <<'PY'
import json
import os
import sys

plan = json.load(open(os.environ["PLAN_FILE"], encoding="utf-8"))
version = plan.get("version")
if not version:
    print("release plan has no publishable version", file=sys.stderr)
    sys.exit(1)
path = os.environ["PACKAGE_JSON"]
with open(path, encoding="utf-8") as handle:
    data = json.load(handle)
data["version"] = version
with open(path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
print(f"applied version: {version}")
print("mode: publish")
print("skipped: git tag, GitHub release, npm publish")
PY
  exit 0
fi

(
  cd "$ROOT"
  npm pack --workspace @arcanetech/privacy-sdk-stellar --dry-run
)

echo "dry-run: packed current package tree; skipped publish, git tag, and upload"
