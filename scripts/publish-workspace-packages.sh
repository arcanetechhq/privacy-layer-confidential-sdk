#!/usr/bin/env bash
# Publish selected workspace packages. Skips a version that is already on npm.
# Env:
#   PUBLISH_PACKAGES — space-separated package names (required for a real publish)
#   DIST_TAGS — space-separated npm dist-tags applied to the Stellar package only
#   DRY_RUN=true|false — when true, print what would publish and exit without registry writes
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

STELLAR_PKG="@arcanetech/privacy-sdk-stellar"
PUBLISH_PACKAGES="${PUBLISH_PACKAGES:-}"
DIST_TAGS="${DIST_TAGS:-}"

if [[ -z "$PUBLISH_PACKAGES" ]]; then
  echo "PUBLISH_PACKAGES is required" >&2
  exit 1
fi

workspace_field() {
  local workspace="$1"
  local field="$2"
  node --input-type=commonjs -e '
    const { execFileSync } = require("node:child_process");
    const workspace = process.argv[1];
    const field = process.argv[2];
    const parsed = JSON.parse(
      execFileSync("npm", ["pkg", "get", field, "--workspace", workspace], {
        encoding: "utf8",
      }),
    );
    const value = typeof parsed === "string" ? parsed : parsed[workspace];
    if (typeof value !== "string" || value.length === 0) {
      process.exit(1);
    }
    process.stdout.write(value);
  ' "$workspace" "$field"
}

publish_workspace() {
  local workspace="$1"
  local name version
  name="$(workspace_field "$workspace" name)"
  version="$(workspace_field "$workspace" version)"
  if npm view "${name}@${version}" version >/dev/null 2>&1; then
    echo "Skip ${name}@${version} (already on npm)"
    return 0
  fi
  if [[ "${DRY_RUN}" == true ]]; then
    echo "Would publish ${name}@${version}"
    return 0
  fi

  local -a tag_args=()
  local publish_tag=""
  if [[ "$name" == "$STELLAR_PKG" && -n "$DIST_TAGS" ]]; then
    read -r -a tags <<< "$DIST_TAGS"
    publish_tag="${tags[0]}"
    for tag in "${tags[@]}"; do
      if [[ "$tag" == "latest" ]]; then
        publish_tag="latest"
      fi
    done
    tag_args=(--tag "$publish_tag")
  fi

  set +e
  local publish_log
  publish_log="$(npm publish --workspace "$workspace" --access public --provenance "${tag_args[@]}" 2>&1)"
  local publish_status=$?
  set -e
  printf '%s\n' "${publish_log}"
  if [[ "${publish_status}" -ne 0 ]]; then
    if grep -Fq "cannot publish over the previously published versions" <<<"${publish_log}"; then
      echo "Skip ${name}@${version} (already on npm)"
      return 0
    fi
    return "${publish_status}"
  fi

  if [[ "$name" == "$STELLAR_PKG" && -n "$DIST_TAGS" ]]; then
    read -r -a tags <<< "$DIST_TAGS"
    for tag in "${tags[@]}"; do
      if [[ "$tag" == "$publish_tag" ]]; then
        continue
      fi
      if npm dist-tag add "${name}@${version}" "$tag"; then
        continue
      fi
      local encoded code
      encoded="${name//\//%2f}"
      code="$(curl -sS -o /tmp/npm-dist-tag-body -w '%{http_code}' -X PUT \
        -H "Authorization: Bearer ${NODE_AUTH_TOKEN:-}" \
        -H "Content-Type: application/json" \
        "https://registry.npmjs.org/-/package/${encoded}/dist-tags/${tag}" \
        --data "\"${version}\"")"
      if [[ "$code" != "200" && "$code" != "201" ]]; then
        echo "warning: could not move dist-tag ${tag} (HTTP ${code}); publish tag ${publish_tag} is already set" >&2
        cat /tmp/npm-dist-tag-body >&2 || true
      fi
    done
  fi
}

for package_name in $PUBLISH_PACKAGES; do
  publish_workspace "$package_name"
done
