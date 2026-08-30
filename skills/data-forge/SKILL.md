---
name: governed-etl-and-schema
description: DataForge runbook — load, transform, and validate data with every write to a real database gated behind human approval.
---

# Governed ETL and Schema Validation (DataForge)

Use this skill when the operator asks for a data load, transform, join,
migration, or warehouse staging.

## Procedure

1. **Inspect (LOW risk — run automatically)**
   - `list_tables` — discover the target schema and confirm table names.
   - `query_readonly` — sample source rows (SELECT only; never mutate).
   - `preview_csv` — check headers, dtypes, and row counts before transform.

2. **Transform (MEDIUM risk — executes in the Docker sandbox only)**
   - `run_etl_script` — the transform (join, clean, aggregate) runs on sample or
     staged data inside the sandbox with pandas/duckdb. The script must be
     deterministic and must not open network connections.

3. **Validate, then gate the write**
   - `validate_schema` — confirm column names, types, and nullability match the
     target. Report drift explicitly.
   - `execute_write` (CRITICAL risk — requires human approval) — propose the write
     ONLY after a clean validation. Include affected row estimates in the proposal.
     The HITL gate pauses until a human approves.
   - If rejected with feedback, adjust the transform and re-validate first.

## Rules

- Reads are free; writes are never automatic.
- No schema drift survives silently — surface every mismatch to the operator.
- Dry-run first when the tool supports it (`dryRun: true`).
