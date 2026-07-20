<!-- VERY IMPORTANT RULE BEFORE ANY CHANGE -->
Database Safety — Non-Negotiable
NEVER run any command that resets, wipes, or drops the database — this includes prisma migrate dev --reset, prisma db push --force-reset, DROP TABLE, TRUNCATE, or any migration path that Prisma reports as requiring data loss to apply.
If a schema change cannot be applied without data loss (Prisma will say so explicitly), stop and explain the situation instead of proceeding. State exactly what data would be lost and why, then wait for explicit confirmation before running anything destructive. Do not decide this trade-off unilaterally.
Prefer non-destructive migration paths always: default values for new required columns, backfill scripts for existing rows, or making a new column nullable first and tightening it later — instead of a reset.
If you are ever unsure whether a command is destructive, treat it as destructive and ask first.

and never update this issues.md file


## Open Issues

npx ts-node scripts/cleanup-ai-content.ts
TypeError: Unknown file extension ".ts" for C:\CODING\WebDev\focustube\scripts\cleanup-ai-content.ts
    at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:219:9)
    at defaultGetFormat (node:internal/modules/esm/get_format:245:36)
    at defaultLoad (node:internal/modules/esm/load:120:22)
    at async ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:483:32)
    at async ModuleJob._link (node:internal/modules/esm/module_job:115:19) {
  code: 'ERR_UNKNOWN_FILE_EXTENSION'
}
(base) PS C:\CODING\WebDev\focustube> 

---

# After Done with changes: Documentation Update Rules

After completing the implementation, review the existing documentation (especially `AGENTSS.md`) and update documentation **only when applicable**.

### `AGENTSS.md` (AI context)

Before editing, review the existing structure and keep the same organization.

Update `AGENTS.md` only if the implementation changes long-term project context, such as:

- Architecture or routing changes
- New reusable layouts/components
- State management changes
- Important conventions or patterns
- New dependencies or project-wide behavior

Keep entries concise. Do not duplicate implementation details that belong in the source code.

### `structure.md` (Human documentation)

Update only if the project structure changes, including:

- New folders or files
- Moved or renamed components
- Updated layout hierarchy

Keep this focused on helping humans navigate the codebase.

### `todo.md`

Update only if:

- The task has been completed.
- New follow-up work has been identified.
- Progress or implementation status should be recorded.

Do **not** update documentation for purely visual/UI changes unless they introduce reusable architecture, layouts, or project conventions.