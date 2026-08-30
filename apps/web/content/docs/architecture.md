---
title: Architecture
description: How Rust, WebAssembly, browser code, and audio adapters divide responsibility.
order: 2
---

# Architecture

Ambiente keeps persisted musical state and event generation in one Rust model.
The piano, matrix, graphical editors, CLI, and planned language and Model Context
Protocol (MCP) server are interfaces over that model.

This guide explains where each part of the system belongs. Read the
[document format](document-format.md) for persistence and migration, the
[composition model](composition-model.md) for musical concepts and deterministic
variation, and [audio](audio.md) for playback. The
[roadmap](https://github.com/stormlightlabs/ambiente/blob/main/ROADMAP.md) tracks
implementation order.

## System shape

```text
                         ambiente-core
                             Rust
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
        ambiente-cli    ambiente-wasm   planned MCP adapter
                              │
                              ▼
                     TypeScript facade
                              │
                  ┌───────────┴───────────┐
                  │                       │
                  ▼                       ▼
              Studio UI             browser audio
                Solid               Web Audio /
                                      Tone.js
                  │
             ┌────┴─────┐
             ▼          ▼
          Vike web    Tauri
```

`ambiente-core` decides what happens and when. Adapters decide how to play,
transmit, or display each event. TypeScript does not reimplement composition
rules.

## Repository and workspace

Two toolchains share the repository:

- Cargo owns Rust crates under `crates/`.
- pnpm owns browser applications and TypeScript packages under `apps/` and
  `packages/`.

The current implementation lives in `crates/core`, `crates/cli`, `crates/wasm`,
the TypeScript wrapper in `packages/wasm`, and the Vike application in
`apps/web`. The web application publishes the documentation from
`apps/web/content/docs/` and imports the WASM-backed TypeScript facade. A new
crate or package needs a concrete responsibility before it is added.

The supported development versions are:

- Rust 1.88.0 with the 2024 edition, pinned by `rust-toolchain.toml`;
- Node.js 24 LTS, with versions 24 through 26 accepted by `package.json`;
- pnpm 11, pinned to 11.14.0 by the `packageManager` field.

Node 24 is the supported LTS release. The workspace also accepts Node 25 and 26,
and pnpm 11 supports Node 22 or newer. See the [Node release table][node-releases]
and [pnpm compatibility table][pnpm-install].

Use the root commands for local checks:

```sh
pnpm install
pnpm format:check
pnpm lint
pnpm test
pnpm check
```

`pnpm check` formats, lints, and tests both workspaces. CI splits the same work
into Rust and web jobs. Rust uses rustfmt and Clippy; TypeScript uses Prettier,
ESLint, and Vitest. Run markdownlint-cli2 locally when checking documentation.

## Rust core

`ambiente-core` is authoritative for:

- document schema, serialization, migration, and validation;
- stable IDs and references;
- document operations;
- musical and absolute time;
- materials, voices, patterns, and later canonical scenes, macros, and captures;
- deterministic seed derivation;
- event generation and inspection.

The core must not depend on a browser, an audio device, Tone.js, MIDI, or a UI
framework. It may expose generalized concepts that those systems can interpret.

Named operations are the only way to change a persisted document. The Studio,
CLI, language, and MCP server therefore share the same edits and validation.

## Errors and diagnostics

The core separates operational Rust errors from user-facing document
diagnostics. An operation that cannot complete returns a typed error such as
`LoadError`, `MigrationError`, `OperationError`, or `TimeError`. Public core APIs
do not return `anyhow::Error`.

`thiserror` may derive `std::error::Error` and `Display` implementations. It does
not become part of the public API shape.[^thiserror]

Validation reports independent problems in one pass as structured diagnostics:

```rust
struct Diagnostic {
    code: DiagnosticCode,
    severity: Severity,
    message: String,
    location: Option<DiagnosticLocation>,
    help: Option<String>,
}
```

A diagnostic location identifies a semantic object and, when relevant, one of
its fields. It does not expose a Rust source span or require a JSON Pointer. A
future language frontend owns locations in DSL source.

Diagnostic behavior follows these rules:

- Codes are stable, machine-readable strings such as `reference.missing` and
  `time.invalid`.
- `Severity` starts with `error` and `warning`. Add another severity only when a
  workflow needs it.
- Human-readable messages may change without changing the meaning of a code.
- A known correction belongs in `help`, separate from data used by machine
  consumers.
- Parse errors retain line and column information when available.
- Validation aggregates independent failures.
- Mutation operations are atomic. A failed operation does not leave a partially
  changed document.
- The CLI, WASM facade, Studio, and MCP adapt the same diagnostic data for their
  users. Terminal rendering does not belong in the core.

## Event boundary

The core emits events without assuming a playback backend. Each event contains a
time span, target, kind, and properties:

```rust
Event {
    span,
    target,
    kind,
    properties,
}
```

An event can represent a note, sample trigger, parameter change, scene change, or
control value. Properties can carry pitch, velocity, gain, pan, filter values,
sample position, MIDI control data, or visual values. MIDI is an output mapping,
not the core event model.

This separation follows the useful distinction in SuperCollider between patterns
that produce values, events that collect those values, and the action used to
play an event.[^supercollider-events]

## WebAssembly boundary

`ambiente-wasm` compiles the core for browser use. Its command/query surface is
narrow:

```text
load(document)
serialize()
apply(operation)
validate()
query_events(span)
inspect()
```

JavaScript receives serializable commands, query results, diagnostics, and small
projections of document state—not a mutable Rust object graph. The
`@ambiente/wasm` package turns generated `wasm-bindgen` bindings and TypeScript
declarations into the browser API.[^wasm-bindgen]

Native Rust and WebAssembly return identical normalized events for the same
document, seed, and time span. Shared fixtures test both runtimes against one
expected event stream.

## Web and desktop

The web application uses Vite, Vike, `vike-solid`, and Solid. Routes have
different rendering needs:

```text
/                 prerendered
/docs/**           prerendered
/learn/**          prerendered
/examples/**       prerendered with interactive components
/studio/**         prerendered SPA shell
```

Vike supports render modes per page and can prerender an SPA shell. If all
routes are prerendered, production consists of static assets and requires no
application server.[^vike-render-modes] [^vike-prerender]

The documentation ships with the web application. Its Markdown and MDX source
lives in `apps/web/content/docs/`. Vite processes both formats through Sätteri and
`vite-plugin-satteri`, with GFM and frontmatter enabled. MDX uses Solid's JSX
runtime through `jsxImportSource: "solid-js/h"`.[^satteri-vite] Sätteri is also
Astro 7's native Markdown and MDX processor.[^astro-satteri] [^satteri]
`satteri-expressive-code` adds highlighted, annotated code blocks.[^satteri-expressive-code]

The Studio uses the WASM facade and shared audio package. Playable guides use
those same production paths. A guide can expose fewer controls, but it cannot
carry a separate pattern engine. The web shell keeps a small fixture adapter for
shell-only tests.

The Tauri application will host the shared Studio. Platform features sit behind
capability adapters, for example:

```text
PieceStorage
├── BrowserPieceStorage
└── DesktopPieceStorage

MidiHost
├── WebMidiHost
└── NativeMidiHost
```

Desktop storage, native MIDI, OSC, file dialogs, and device settings must not
fork the document model or Studio UI.

## CLI and MCP

The CLI calls `ambiente-core` directly. Its human output is concise by default,
with structured output for commands that need it. Primary output goes to
`stdout`; diagnostics and progress go to `stderr`. Commands use meaningful exit
codes and never require a prompt in scripts. Color and animation depend on the
relevant stream being a TTY and honor `NO_COLOR`, `TERM=dumb`, and
`--no-color`.

The future MCP server will reuse core operations and validation. Its tools will
name musical actions such as adding material, setting a step, applying a process,
or querying events. It will not ask an agent to generate Tone.js scheduler code
or mutate source strings.

## Architectural invariants

1. Rust owns canonical musical state.
2. The event stream is independent of audio, MIDI, OSC, and visualization
   backends.
3. Identical documents, seeds, and time spans produce identical events.
4. Music theory assists patterns; it does not define the entire composition
   model.
5. A `Voice` is more fundamental than a DAW `Track`.
6. Every editor and protocol changes the same document through the same semantic
   operations.
7. Web and desktop share the Studio.
8. Real-time audio details do not enter persisted documents.
9. Generated variation remains constrained by authored material and intent.
10. The Three Studies must produce worthwhile music before broad platform or
    feature expansion.
11. Listen, Create, and Perform are views of one piece.
12. New complexity must enable a concrete musical workflow.

Revise any design that conflicts with these invariants before implementing it.

[node-releases]: https://nodejs.org/en/about/previous-releases
[pnpm-install]: https://pnpm.io/installation#compatibility

[^thiserror]: [`thiserror`](https://docs.rs/thiserror/latest/thiserror/)

[^supercollider-events]: [SuperCollider, _Understanding the difference between Pattern, Stream and Event_](https://doc.sccode.org/Tutorials/A-Practical-Guide/PG_01_Introduction.html#What%20is%20a%20Pattern?)

[^wasm-bindgen]: [The `wasm-bindgen` Guide](https://wasm-bindgen.github.io/wasm-bindgen/)

[^vike-render-modes]: [Vike, _Render Modes_](https://vike.dev/render-modes)

[^vike-prerender]: [Vike, _Pre-rendering (SSG)_](https://vike.dev/pre-rendering)

[^astro-satteri]: [Astro 7.0, _Sätteri: native Markdown parsing_](https://astro.build/blog/astro-7/#sätteri-native-markdown-parsing)

[^satteri]: [Sätteri documentation](https://satteri.bruits.org/docs/)

[^satteri-vite]: [`vite-plugin-satteri`](https://github.com/bruits/satteri/tree/main/packages/vite-plugin-satteri)

[^satteri-expressive-code]: [`satteri-expressive-code`](https://github.com/bruits/satteri/tree/main/packages/satteri-expressive-code)
