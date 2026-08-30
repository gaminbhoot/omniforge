---
name: cve-triage-and-patch
description: SecurForge runbook — triage a reported CVE, prove exploitability in the sandbox, and prepare a patch pull request for human review.
---

# CVE Triage and Patch (SecurForge)

Use this skill when the operator reports a CVE, vulnerable dependency, or
suspicious diff.

## Procedure

1. **Scan (LOW risk — run automatically)**
   - `scan_dependencies` — enumerate affected manifests and confirm the vulnerable
     version range is actually present.
   - `inspect_diff` — for suspected injected code, review the diff before anything else.

2. **Prove (MEDIUM risk — executes in the Docker sandbox only)**
   - `test_exploit` — reproduce the vulnerability against sample inputs INSIDE the
     sandbox to confirm real (not theoretical) exploitability. The sandbox is
     isolated: no network egress to production targets, read-only filesystem.

3. **Patch (HIGH risk — requires human approval)**
   - `create_patch_pr` — open a patch PR with: the bump/fix, a regression test,
     and the sandbox exploit evidence in the body. The HITL gate pauses the
     mission until a human approves opening the PR.
   - If rejected with feedback, refine the patch and regression tests, then
     re-propose once.

## Rules

- Never open a PR without sandbox evidence attached.
- One CVE per PR; keep patches minimal and reviewable.
- Cite the CVE ID, affected versions, and fixed version in every proposal.
