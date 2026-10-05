# Releasing

Developer steps for a normal package publish are in the README. This file is for maintainers who cut a release branch, move `latest`, or change GitHub branch protection.

## Branches

| Branch | Package major | npm dist-tag |
| --- | --- | --- |
| `main` | Current major | `latest` |
| `release/v0` | 0 | `release-v0` |
| `release/v1` | 1 | `release-v1` |

`release/v0` is the maintenance line for the packages that were published from `development`. `@arcanetech/privacy-sdk-stellar` on that branch depends on `@arcanetech/stellar-privacy-pool-zk-sdk` at `>=0.11.0 <1.0.0`. `scripts/check-majors.mjs` rejects a range that includes `1.0.0` or above. New publishes from `release/v0` use the `release-v0` dist-tag only. They do not move `latest` or the old `sdk-v0` tag.

`release/v1` is cut from `v1`. Every public package on that branch is `1.0.0`. `@arcanetech/privacy-sdk-stellar` on `main` and `release/v1` depends on `@arcanetech/stellar-privacy-pool-zk-sdk` at `>=1.0.0-rc.0 <2.0.0`. That range installs the published `1.0.0-rc.0`, which samples a high-entropy escrow nonce. `>=1.0.0 <2.0.0` does not match that release candidate, so it cannot be installed yet. Publishes from `release/v1` use the `release-v1` dist-tag only.

npm 11 refuses a dist-tag that is a valid semver range, so `v0` and `v1` cannot be tags. The release lines use `release-v0` and `release-v1` instead. Neither tag moves `latest`.

`main` is `development` plus the `v1` product commits (incoming-note assessment and the escrow-sweep fix), then a major bump of every public package to `1.0.0`. That `1.0.0` publish is the one that moves `latest`. A follow-up minor changeset on `main` opens the `1.1.0` line so later `latest` versions are not the same versions `release/v1` will publish as `1.0.x`.

`development` and `v1` stay in the repository. `.github/workflows/release.yml` does not run on those names.

## Backport and forward-port

1. Fix the bug on the oldest release branch that should receive it. Add a new `patch` or `minor` changeset in that pull request.
2. If `main` needs the same fix, cherry-pick the code onto a branch from `main` and add a new changeset there. Do not copy the changeset file. Each branch has its own unpublished changesets, and the changelogs diverge.

## Cut the next major

Run this while `main` still contains only the major you are about to freeze. Do not land the breaking changes on `main` first.

1. Merge the open "Version Packages" pull request on `main` so every pending changeset for the current major is published.
2. Run the "Create release branch" workflow (`workflow_dispatch`) with `major` set to that major. It checks that every public package is already that major, then pushes `release/vN` with `.changeset/config.json` `baseBranch` set to `release/vN`.
3. On `main`, run `npm run changeset:major`, merge the breaking changes, and merge the generated "Version Packages" pull request. Packages publish as major `N+1` with dist-tag `latest`.

The workflow needs `RELEASE_BOT_TOKEN` (a GitHub App token or PAT that can push and open pull requests). A pull request opened with the default `GITHUB_TOKEN` does not start other workflows, so required checks on the version pull request never run.

## First 1.0.0 and 1.1.0

`1.0.0` is published once, from `main`, as `latest`. `release/v1` is at the same `1.0.0`. Its publish skips versions that are already on npm and does not move `latest`.

After that publish, `main` contains a minor changeset for every public package. Merging the resulting "Version Packages" pull request publishes `1.1.0` as `latest`. Further `1.0.x` releases belong to `release/v1` and use dist-tag `release-v1`.

If `RELEASE_BOT_TOKEN` is missing, the release workflow fails before it publishes. Add the token, then re-run the workflow on the `1.0.0` commit on `main` before merging the `1.1.0` version pull request. Otherwise `1.0.0` never becomes `latest`.

## GitHub rulesets

Apply these only after `RELEASE_BOT_TOKEN` can open a pull request that starts the PR checks. Required checks that never run will block the version pull request.

One ruleset for `main` and one for `release/**`:

- Pull request required, at least 1 approval.
- Required status checks: `check-majors`, `build-and-test`.
- Block force pushes and branch deletion.

A separate ruleset restricts who can create `release/**` to maintainers. The GitHub App behind `RELEASE_BOT_TOKEN` must be allowed to create and push those branches, because "Create release branch" pushes `release/vN`.

`changeset-status` is intentionally not required. The version pull request often has no new changeset of its own, and a required `changeset status` check can fail on that pull request.

Example creation payload for `main` (repeat with `name` `release-branches` and `conditions.ref_name.include` `["refs/heads/release/**"]` for release branches):

```json
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/main"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "check-majors" },
          { "context": "build-and-test" }
        ]
      }
    }
  ],
  "bypass_actors": []
}
```

Create them with `gh api`:

```bash
gh api --method POST repos/Polynom-Labs/privacy-layer-confidential-sdk/rulesets --input ruleset.json
```

Creation of `release/**` can be limited with a repository ruleset whose target is branch creation, if the GitHub plan exposes that rule. Otherwise limit it with a ruleset on `release/**` that blocks pushes from people who are not maintainers, and add the release App as a bypass actor.
