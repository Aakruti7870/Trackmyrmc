---
name: RMC local main branch is unrelated history to origin/main
description: Why `git checkout main` / merging it in this repo is dangerous, and the safe recovery command.
---

The Replit workspace's local `main` branch is the original Replit-created project
scaffold (just the mockup-sandbox/canvas starter — commits like "Initial commit" /
"Add day and night theme mockups to sandbox"). It has **unrelated git history**
from `origin/main` on the connected GitHub repo (Aakruti7870/Trackmyrmc), which is
where all real TrackMyRMC app work (rmc-app/, server/) actually lives, merged in
via PRs from feature branches.

**Why:** The GitHub repo was connected to a pre-existing Replit project rather than
the project being cloned fresh from it, so local `main` never shared a root commit
with the GitHub repo's `main`. Running `git checkout main` silently swaps the whole
working tree to that unrelated scaffold — deletes rmc-app/server source files from
disk (still safe in git history, just not in the working copy), and Replit's
environment automation reacts to the changed `.replit`/file structure by tearing
down the real workflows (Start application/test/build/lint/Backend API) and
re-registering the project as a bare design-mockup artifact. `git merge --ff-only
origin/main` from that state fails with "refusing to merge unrelated histories" —
that error is the tripwire that something is wrong, not a fixable merge conflict.

**How to apply:** Never `git checkout main` or merge into it without first
comparing histories (`git merge-base main origin/main`, or just diff-stat them).
To sync the workspace with the real app after a PR merges on GitHub, run
`git checkout -B main origin/main` directly — this force-resets local main to
match origin/main and restores the real source tree in one step. After that,
restart the `Backend API` and `Start application` workflows explicitly (they can
come back auto-registered but stuck on a stale crash log from the mid-swap
filesystem state) and verify both ports with curl before declaring it fixed.
