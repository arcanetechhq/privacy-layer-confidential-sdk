#!/usr/bin/env bash
# Plan (and optionally apply) the privacy SDK Stellar package release for a release line.
# DRY_RUN=1: print the plan, pack the Stellar package, perform no publish side effects.
# DRY_RUN=0: print the same plan, write the selected version into package.json,
#            and leave tagging / npm publish to the caller.
# Line 1 plans do not mutate the checkout's zk SDK range; they print the range the
# publish would use. PROMOTE_STABLE=1 and STABLE_1X_PUBLISHED=1 are local inputs
# (same kind as the zk SDK script), not commit trailers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_JSON="$ROOT/packages/stellar/package.json"
ZK_SDK_DEP="@arcanetech/stellar-privacy-pool-zk-sdk"
LINE_0_ZK_RANGE=">=0.11.0 <1.0.0"
LINE_1_ZK_RANGE=">=1.0.0 <2.0.0"
LINE_0_MANIFEST="stellar/v0/circuits-manifest.json"
LINE_1_MANIFEST="stellar/v1/circuits-manifest.json"
STELLAR_PKG="@arcanetech/privacy-sdk-stellar"
SKIPPED_PKGS="@arcanetech/privacy-sdk-core @arcanetech/privacy-sdk-relay @arcanetech/privacy-sdk-state-memory @arcanetech/privacy-sdk-state-redux"

DRY_RUN="${DRY_RUN:-1}"
RELEASE_LINE="${RELEASE_LINE:-}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-}"
PROMOTE_STABLE="${PROMOTE_STABLE:-0}"
STABLE_1X_PUBLISHED="${STABLE_1X_PUBLISHED:-0}"

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

if [[ "$RELEASE_LINE" != "0" && "$RELEASE_LINE" != "1" ]]; then
  echo "RELEASE_LINE=${RELEASE_LINE} is not supported" >&2
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

# Line 0 requires the 0.x zk window. Line 1 dry-run may run on a 0.x checkout
# (plan only) or on a tree that already carries the 1.x window after apply.
if [[ "$RELEASE_LINE" == "0" ]]; then
  if [[ "$current_zk_range" != "$LINE_0_ZK_RANGE" ]]; then
    echo "Stellar package zk SDK range must be ${LINE_0_ZK_RANGE}, found: ${current_zk_range}" >&2
    exit 1
  fi
elif [[ "$current_zk_range" != "$LINE_0_ZK_RANGE" && "$current_zk_range" != "$LINE_1_ZK_RANGE" ]]; then
  echo "Stellar package zk SDK range must be ${LINE_0_ZK_RANGE} or ${LINE_1_ZK_RANGE}, found: ${current_zk_range}" >&2
  exit 1
fi

PLAN_FILE="$(mktemp)"
trap 'rm -f "$PLAN_FILE"' EXIT

COMMIT_MESSAGE="$COMMIT_MESSAGE" \
CURRENT_VERSION="$current_version" \
RELEASE_LINE="$RELEASE_LINE" \
PROMOTE_STABLE="$PROMOTE_STABLE" \
STABLE_1X_PUBLISHED="$STABLE_1X_PUBLISHED" \
LINE_0_MANIFEST="$LINE_0_MANIFEST" \
LINE_1_MANIFEST="$LINE_1_MANIFEST" \
LINE_0_ZK_RANGE="$LINE_0_ZK_RANGE" \
LINE_1_ZK_RANGE="$LINE_1_ZK_RANGE" \
STELLAR_PKG="$STELLAR_PKG" \
SKIPPED_PKGS="$SKIPPED_PKGS" \
PLAN_FILE="$PLAN_FILE" \
python3 - <<'PY'
import json
import os
import re
import sys

message = os.environ["COMMIT_MESSAGE"]
version = os.environ["CURRENT_VERSION"]
release_line = os.environ["RELEASE_LINE"]
promote_stable = os.environ.get("PROMOTE_STABLE", "0") == "1"
stable_1x_published = os.environ.get("STABLE_1X_PUBLISHED", "0") == "1"
line_0_manifest = os.environ["LINE_0_MANIFEST"]
line_1_manifest = os.environ["LINE_1_MANIFEST"]
line_0_zk_range = os.environ["LINE_0_ZK_RANGE"]
line_1_zk_range = os.environ["LINE_1_ZK_RANGE"]
stellar_pkg = os.environ["STELLAR_PKG"]
skipped_pkgs = os.environ["SKIPPED_PKGS"]
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

def write_plan(
    next_version: str | None,
    dist_tags: str | None,
    manifest: str,
    breaking_verdict: str,
    zk_range: str,
    publish_selected: list[str],
    publish_skipped: list[str],
):
    plan = {
        "version": next_version,
        "distTags": dist_tags.split() if dist_tags else [],
        "circuitsManifest": manifest,
        "breakingCommit": breaking_verdict,
        "zkSdkRange": zk_range,
        "publishSelected": publish_selected,
        "publishSkipped": publish_skipped,
    }
    with open(plan_file, "w", encoding="utf-8") as handle:
        json.dump(plan, handle)
        handle.write("\n")

def print_line1_selection():
    print(f"publish-selected: {stellar_pkg}")
    print(f"publish-skipped: {skipped_pkgs}")

if release_line == "0":
    if breaking:
        write_plan(
            None,
            None,
            line_0_manifest,
            "refuse",
            line_0_zk_range,
            [stellar_pkg],
            [],
        )
        print("breaking-commit: refuse")
        print(f"circuits-manifest: {line_0_manifest}")
        print(f"zk-sdk-range: {line_0_zk_range}")
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
    if stable_1x_published:
        dist_tags = "v0"
    else:
        dist_tags = "v0 latest"
    write_plan(
        next_version,
        dist_tags,
        line_0_manifest,
        "allow",
        line_0_zk_range,
        [stellar_pkg],
        [],
    )
    print(f"version: {next_version}")
    print(f"dist-tags: {dist_tags}")
    print(f"circuits-manifest: {line_0_manifest}")
    print(f"zk-sdk-range: {line_0_zk_range}")
    print("breaking-commit: allow")
    print("protected-path: allow")
    sys.exit(0)

# release_line == "1"
# Core, state, and relay are not selected for publish from line 1; Stellar is.
if promote_stable:
    write_plan(
        "1.0.0",
        "latest",
        line_1_manifest,
        "allow",
        line_1_zk_range,
        [stellar_pkg],
        skipped_pkgs.split(),
    )
    print("version: 1.0.0")
    print("dist-tags: latest")
    print(f"circuits-manifest: {line_1_manifest}")
    print(f"zk-sdk-range: {line_1_zk_range}")
    print_line1_selection()
    print("breaking-commit: allow")
    print("protected-path: allow")
    sys.exit(0)

if not stable_1x_published:
    # Before promotion: any conventional commit (including breaking) plans the next
    # 1.0.0-rc.N. This 0.x checkout is still 0.6.1, so the first RC is 1.0.0-rc.0.
    kind = commit_kind(message)
    if kind not in ("fix", "feat"):
        print(f"unsupported commit type in message: {message!r}", file=sys.stderr)
        sys.exit(1)
    major, _, _ = parse_semver(version)
    if major >= 1 and version.startswith("1.0.0-rc."):
        rc_n = int(version.rsplit(".", 1)[-1]) + 1
        next_version = f"1.0.0-rc.{rc_n}"
    else:
        next_version = "1.0.0-rc.0"
    write_plan(
        next_version,
        "next",
        line_1_manifest,
        "allow",
        line_1_zk_range,
        [stellar_pkg],
        skipped_pkgs.split(),
    )
    print(f"version: {next_version}")
    print("dist-tags: next")
    print(f"circuits-manifest: {line_1_manifest}")
    print(f"zk-sdk-range: {line_1_zk_range}")
    print_line1_selection()
    print("breaking-commit: allow")
    print("protected-path: allow")
    sys.exit(0)

# After promotion: stable 1.x bumps on latest (fix=patch, feat=minor).
kind = commit_kind(message)
major, minor, patch = parse_semver(version)
if major < 1:
    # Dry-run does not mutate package.json; when stable 1.x is signaled but the
    # tree is still on 0.x, bumps start from the promoted 1.0.0.
    major, minor, patch = 1, 0, 0

if kind == "feat":
    minor += 1
    patch = 0
elif kind == "fix":
    patch += 1
else:
    print(f"unsupported commit type in message: {message!r}", file=sys.stderr)
    sys.exit(1)

next_version = f"{major}.{minor}.{patch}"
write_plan(
    next_version,
    "latest",
    line_1_manifest,
    "allow",
    line_1_zk_range,
    [stellar_pkg],
    skipped_pkgs.split(),
)
print(f"version: {next_version}")
print("dist-tags: latest")
print(f"circuits-manifest: {line_1_manifest}")
print(f"zk-sdk-range: {line_1_zk_range}")
print_line1_selection()
print("breaking-commit: allow")
print("protected-path: allow")
PY

if [[ "$DRY_RUN" == "0" ]]; then
  PACKAGE_JSON="$PACKAGE_JSON" \
  PLAN_FILE="$PLAN_FILE" \
  ZK_SDK_DEP="$ZK_SDK_DEP" \
  python3 - <<'PY'
import json
import os
import sys

plan = json.load(open(os.environ["PLAN_FILE"], encoding="utf-8"))
version = plan.get("version")
if not version:
    print("release plan has no publishable version", file=sys.stderr)
    sys.exit(1)
path = os.environ["PACKAGE_JSON"]
zk_dep = os.environ["ZK_SDK_DEP"]
zk_range = plan.get("zkSdkRange")
with open(path, encoding="utf-8") as handle:
    data = json.load(handle)
data["version"] = version
if zk_range:
    deps = data.setdefault("dependencies", {})
    deps[zk_dep] = zk_range
with open(path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
print(f"applied version: {version}")
if zk_range:
    print(f"applied zk-sdk-range: {zk_range}")
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
