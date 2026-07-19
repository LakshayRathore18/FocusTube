# Issues to Resolve

---

## Before You Start

Read `agent.md` before making any changes.

Use it to understand:

- The current project architecture and status.
- Existing project conventions and implementation patterns.
- Relevant files for this task (see **Directory Map**).
- Important constraints and gotchas (see **Critical Conventions & Gotchas**).

Do not assume the project structure from previous tasks or memory. Follow the existing conventions documented in `agent.md` and inspect the referenced files when implementation details are needed.

---

## Open Issues/To do


Reasonable — easier to run through the 4-5 test cases with a form than copy-pasting URLs into the browser bar. Keep it minimal and temporary, same as the route.

---

Create a small temporary UI page to manually test the transcript pipeline, replacing manual URL testing of `/api/test-transcript`.

**Create `src/app/test-transcript/page.tsx`** (client component):
- Simple form: one text input for a YouTube video ID (or full URL — if a full URL is pasted, extract the ID client-side using the same/similar logic as `extractPlaylistId` in `lib/youtube.ts`, or just accept raw IDs to keep it simple, your call) + a "Fetch Transcript" button
- On submit, calls `GET /api/test-transcript?videoId=...` and shows a loading state while waiting
- Displays the result clearly:
  - If `success: true` — show `transcriptLength` and the `preview` text in a scrollable box
  - If `success: false` — show the `reason` code prominently (this is the important part, since we're validating error classification)
- Keep a running list on the page of the last 5-10 test attempts (videoId + result), so multiple test cases can be compared side by side without re-running each one — a simple array in component state is enough, no persistence needed
- No auth check, no styling polish — plain Tailwind utility classes, functional over pretty
- Add a comment at the top: `// TEMP: manual QA page for transcript pipeline, delete once validated`

Don't touch `src/lib/transcript.ts` or the API route — this only consumes the existing endpoint.

---

# Documentation Update Rules

**Do not modify this `issues.md` file while implementing the issue.**

After completing the implementation, review the existing documentation (especially `agent.md`) and update documentation **only when applicable**.

### `agent.md` (AI context)

Before editing, review the existing structure and keep the same organization.

Update `agent.md` only if the implementation changes long-term project context, such as:

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