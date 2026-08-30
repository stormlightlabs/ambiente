# Architecture

Ambiente uses one Rust model for persisted musical state and event generation. The
piano, matrix, graphical editors, future language, CLI, and future Model Context
Protocol (MCP) server are interfaces over that model.

This page records the system boundaries and invariants. See the
[document format](document-format.md) for identity, persistence, and migration;
the [composition model](composition-model.md) for musical concepts, time, and
deterministic randomness; [audio](audio.md) for playback; and the
[roadmap](ROADMAP.md) for sequencing.

## System shape

```text
                         ambiente-core
                             Rust
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
        ambiente-cli    ambiente-wasm     ambiente-mcp
                              │
                              ▼
                     TypeScript facade
                              │
                  ┌───────────┴───────────┐
                  │                       │
                  ▼                       ▼
              Studio UI               audio-web
                Solid               Web Audio /
                                      Tone.js
                  │
             ┌────┴─────┐
             ▼          ▼
          Vike web    Tauri
```

`ambiente-core` answers what happens and when. A playback adapter decides how an
event sounds or how another target, such as MIDI or a visualization, handles it.
TypeScript must not implement a parallel composition engine.

## Repository and workspace

The repository has two workspaces:

- Cargo owns Rust crates under `crates/`.
- pnpm owns browser applications and TypeScript packages under `apps/` and
  `packages/`.

Only `crates/core` and `crates/cli` exist at the reboot boundary. Add
`crates/wasm` after the core has an API worth exposing. Add other crates and
packages only when implemented behavior gives them a clear boundary.

The supported development versions are:

- Rust 1.88.0 with the 2024 edition, pinned by `rust-toolchain.toml`;
- Node.js 24 LTS, with versions 24 through 26 accepted by `package.json`;
- pnpm 11, pinned to 11.14.0 by the `packageManager` field.

Node recommends an Active or Maintenance LTS release for production. Node 24 is
LTS, while Node 26 is Current at the time of this decision. pnpm 11 supports
Node 22 and newer. See the [Node release table][node-releases] and
[pnpm compatibility table][pnpm-install].

Use the root commands for local checks:

```sh
pnpm install
pnpm format:check
pnpm lint
pnpm test
pnpm check
```

`pnpm check` runs formatting, linting, and tests for both workspaces. The CI
workflow runs the same checks as separate Rust and web jobs. Rust formatting and
linting use `rustfmt` and Clippy. TypeScript formatting, linting, and tests use
Prettier, ESLint, and Vitest. Markdown is checked with markdownlint-cli2.

## Rust core

`ambiente-core` is authoritative for:

- document schema, serialization, migration, and validation;
- stable IDs and references;
- document operations;
- musical and absolute time;
- materials, voices, patterns, scenes, macros, and captures;
- deterministic seed derivation;
- event generation and inspection.

The core must not depend on a browser, an audio device, Tone.js, MIDI, or a UI
framework. It may expose generalized concepts that those systems can interpret.

A persisted document is changed through operations rather than arbitrary mutable
access. This gives the Studio, CLI, language, and MCP server the same edit
semantics and validation behavior.

## Errors and diagnostics

The core separates operational Rust errors from user-facing document
diagnostics. An operation that cannot complete returns a typed error such as
`LoadError`, `MigrationError`, `OperationError`, or `TimeError`. Public core APIs
do not return `anyhow::Error`.

`thiserror` may derive `std::error::Error` and `Display` implementations. It does
not become part of the public API shape.[^thiserror]

Validation reports independent problems in one pass as structured diagnostics:

```rust,ignore
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

The core emits backend-independent events. An event conceptually contains a time
span, target, kind, and properties:

```rust,ignore
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

`ambiente-wasm` will compile the core for browser use. Its command/query surface
should remain narrow:

```text
load(document)
save()
apply(operation)
validate()
query(span)
inspect(...)
```

JavaScript should receive serializable commands, query results, diagnostics, and
selected projections. It should not receive an enormous mutable Rust object
graph. A small TypeScript facade can translate generated bindings into an
idiomatic browser API. `wasm-bindgen` can emit TypeScript declarations for its
exports.[^wasm-bindgen]

Native Rust and WebAssembly must return identical normalized events for the same
document, seed, and time span. Shared fixtures will test this property.

## Web and desktop

The web application will use Vite, Vike, `vike-solid`, and Solid. Routes have
different rendering needs:

```text
/                 prerendered
/docs/**           prerendered
/learn/**          prerendered
/examples/**       prerendered with interactive components
/studio/**         prerendered SPA shell
/listen/**         prerendered shell or content as appropriate
```

Vike supports render modes per page and can prerender an SPA shell. If all
routes are prerendered, production consists of static assets and requires no
application server.[^vike-render-modes] [^vike-prerender]

The Studio and interactive documentation examples must use the same WASM facade
and audio package. A documentation example may be smaller than the Studio, but
it must not contain a demo-only pattern engine.

The Tauri application will host the shared Studio. Platform features sit behind
capability adapters, for example:

```text
ProjectStorage
├── BrowserProjectStorage
└── DesktopProjectStorage

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

A design that violates several invariants needs revision before implementation.

[node-releases]: https://nodejs.org/en/about/previous-releases
[pnpm-install]: https://pnpm.io/installation#compatibility

[^thiserror]: [`thiserror`](https://docs.rs/thiserror/latest/thiserror/)

[^supercollider-events]: [SuperCollider, _Understanding the difference between Pattern, Stream and Event_](https://doc.sccode.org/Tutorials/A-Practical-Guide/PG_01_Introduction.html#What%20is%20a%20Pattern?)

[^wasm-bindgen]: [The `wasm-bindgen` Guide](https://wasm-bindgen.github.io/wasm-bindgen/)

[^vike-render-modes]: [Vike, _Render Modes_](https://vike.dev/render-modes)

[^vike-prerender]: [Vike, _Pre-rendering (SSG)_](https://vike.dev/pre-rendering)
