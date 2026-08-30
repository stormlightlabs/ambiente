# AGENTS

## Code

- Add TSDoc or rustdoc comments to all exported and contextually important symbols.

### Rust

- Use the writing-rust and review-rust skills as appropriate.

### TypeScript

- Use an interface only when a class or object implements its complete method set.
  Use a type otherwise.

## Documentation

- Use the writing skill for all prose.
- Keep `ROADMAP.md` focused on product direction and sequencing.
- Treat `apps/web/content/docs/` as the canonical source for documentation that the
  web application will publish.
- Keep `TODO.md` as an outstanding-work checklist. Remove completed tasks instead of
  accumulating checked boxes.
- Summarize completed work under `CHANGELOG.md`'s `Unreleased` section using Keep a
  Changelog categories; do not turn the changelog into a task-by-task transcript.
- Put architecture and rationale in the relevant document instead of repeating them
  in `TODO.md`.

## Architecture

- Keep `ambiente-core` authoritative for persisted musical state and event generation.
- Do not duplicate composition or pattern semantics in TypeScript.
- Keep real-time audio implementation details out of persisted documents.
- Require identical output for identical document, seed, and time span inputs.
- Prefer a small set of composable musical primitives to many specialized generators.
- Treat the piano, matrix, graphical editors, DSL, CLI, and MCP as interfaces over the
  same document model.
- Do not introduce a canonical `Song -> Track -> MIDI notes` hierarchy.
- Add platform or infrastructure work only when it enables a concrete musical workflow.
- Gate major feature expansion on the Three Studies producing music worth listening to.
- Create crates and packages only when their boundaries exist. Do not pre-create empty
  parts of the planned repository structure.

## CLI

- Use `clap` for argument parsing and help generation.
- Use `owo-colors` for terminal styling.
- Follow [Command Line Interface Guidelines](https://clig.dev/) unless a project
  requirement calls for a deliberate exception.
- Keep primary and machine-readable output on `stdout`; send diagnostics and progress
  messages to `stderr`.
- Preserve scripting behavior: meaningful exit codes, `--json` or plain output where
  appropriate, no required prompts, and no color or animation when the relevant stream is not a TTY.
- Honor `NO_COLOR`, `TERM=dumb`, and `--no-color`. Use color to add meaning, never as
  the only way to convey it.
