---
title: Document format
description: How Ambiente identifies, stores, migrates, and validates a piece.
order: 3
---

# Document format

Ambiente stores each piece as a versioned UTF-8 JSON document. The format defines
identity, serialization, migration, and validation. Read the
[composition model](composition-model.md) for musical concepts and
[audio](audio.md) for runtime state that never enters the document.

## Stable IDs

Every persisted entity has a typed ID backed by UUID version 4:

```rust
struct VoiceId(Uuid);
struct MaterialId(Uuid);
struct PatternId(Uuid);
```

The document stores IDs as lowercase, hyphenated UUID strings:

```json
"9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860"
```

Ambiente needs IDs that can be created independently; it does not need IDs that
sort by creation time. The `uuid` project recommends v4 for uniqueness and v7
when sorting or database locality matters.[^uuid] Because creation time is not
part of an Ambiente object's identity, UUIDv7 would add unwanted meaning.

The following rules apply:

- IDs are opaque. Their bytes do not encode order, creation time, type, or
  musical meaning.
- Rust APIs use a distinct newtype for each entity kind instead of passing bare
  `Uuid` values where the type is known.
- Nil UUIDs are not valid entity IDs.
- Renaming, moving, or editing an object preserves its ID.
- Duplicating an object creates a new ID unless the operation explicitly
  preserves identity.
- Names, collection indexes, document positions, musical content, and the root
  composition seed do not determine IDs.
- Tests normally use fixed parsed IDs instead of generated IDs.

ID generation is separate from musical determinism. Native and browser adapters
may use different entropy sources as long as they produce valid UUIDv4 values.
The `uuid` crate supports Serde and UUID generation; its v4 constructor uses a
system randomness backend.[^uuid-v4]

## JSON representation

Standalone reboot projects use the `.ambiente.json` extension. Each document
starts with a format sentinel and an integer schema version:

```json
{ "format": "ambiente", "schema_version": 2, "id": "9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860", "piece": {} }
```

JSON works in browsers, has mature Serde support, is readable in source control,
and can be migrated through `serde_json::Value`.[^serde] A future `.ambiente`
container may bundle assets, but the versioned JSON document remains the musical
schema.

Schema 2 replaces each voice's optional `material` field with an optional
`pattern`. Loading schema 1 wraps a non-null material ID in a `material` source
pattern and preserves a null value as no pattern.

The following rules define the canonical representation:

- `format` is exactly `"ambiente"`.
- `schema_version` is a positive, monotonically increasing `u32`. It is
  independent of package and application SemVer.
- The encoder writes only the current schema version.
- Canonical files are pretty-printed and end with a newline.
- Persisted enum variants use explicit, stable string tags. Rust variant names
  are not the wire format, and schema types do not use untagged enums. Serde
  supports explicit tagged enum representations.[^serde-enums]
- Persisted schema structs reject unknown fields unless a field is explicitly
  an extension map. Serde ignores unknown JSON fields by default, which could
  silently discard document information.[^serde-unknown]
- A newly required field causes a schema migration. It does not use
  `#[serde(default)]` to make an old document look current.
- Maps that affect serialized output use deterministic key ordering.
  `serde_json::Map` uses `BTreeMap` unless insertion-order preservation is
  enabled.[^serde-map]
- IDs, seeds, time, and other exact semantic values are not stored as JSON
  floating-point numbers.

One canonical encoder writes project files. Other code does not call Serde
directly for this job, so formatting and wire-format decisions stay in one place.

## Browser library

Studio stores local pieces in IndexedDB through `PieceStorage`. Each record keeps
the complete canonical document plus the title, document ID, document schema
version, and timestamps needed to display the library. The index is not another
music model. Opening a piece sends its saved document through the Rust loader,
and saving replaces the stored document atomically.

Studio saves edits after a short idle delay and also offers an explicit save
action. Import validates and canonicalizes a piece through the WASM facade before
it enters the library. Export downloads that same canonical representation as an
`.ambiente.json` file.

The IndexedDB schema version and Ambiente's `schema_version` have separate jobs.
Dexie migrations change browser indexes or record layout. Document migrations
change the canonical music format in Rust. Tests run these migration paths
separately. Studio asks the browser to protect local data from automatic eviction;
when the browser declines, local pieces still work and Studio advises exporting
important files. Quota failures leave the previous saved record unchanged.

## Schema migration

Loading runs a deterministic, sequential migration before strict deserialization
and semantic validation:

```text
UTF-8 bytes
  -> JSON value
  -> verify format + schema_version
  -> migrate vN -> vN+1 -> ... -> current
  -> strict current-schema deserialize
  -> validate references and semantic invariants
  -> Document
```

Each migration advances one schema version:

```rust
fn migrate_v1_to_v2(value: Value) -> Result<Value, MigrationError>;
```

Migration follows these rules:

- A missing, zero, malformed, or future `schema_version` is an error.
- When a document is newer than the application, the diagnostic identifies
  both versions. The loader does not attempt a best-effort forward load.
- Migrations are pure transformations. They do not read the clock, consume
  randomness, access audio or devices, or perform network I/O.
- A migration preserves every field that it does not intentionally transform.
  It does not deserialize an old document into the current Rust type and risk
  dropping old data.
- Every migration has fixtures for the old representation and the expected
  current representation.
- Loading migrates an old document in memory. Only saving or an explicit future
  migration command writes the current representation.
- The loader records the source schema version so callers can report that an
  in-memory migration occurred.
- A migration does not silently change a saved realization. If changed pattern
  or randomness semantics cannot reproduce existing behavior, the old semantic
  version remains representable.

Migrations normally transform `serde_json::Value`, which avoids maintaining a
complete Rust model for every old schema. A migration can use a typed historical
wire struct when that makes the transformation easier to review.

## Compatibility tests

The document format requires tests that prove:

- entity IDs round-trip in canonical form and reject nil UUIDs;
- a minimal document writes `format = "ambiente"` and the current schema version;
- save, load, and save again produce a semantically equal, canonically stable
  document;
- unknown fields and future schema versions are rejected; and
- each migration advances one version without changing its input fixture.

These tests protect saved work from accidental format changes. If a dependency
update changes a fixture, understand and accept the format change before updating
the expected file.

[^uuid]: [`uuid`, _Working with different UUID versions_](https://docs.rs/uuid/latest/uuid/#working-with-different-uuid-versions)

[^uuid-v4]: [`uuid`, UUIDv4 implementation](https://docs.rs/uuid/latest/src/uuid/v4.rs.html)

[^serde]: [Serde](https://serde.rs/) and [`serde_json`](https://docs.rs/serde_json/latest/serde_json/)

[^serde-enums]: [Serde, _Enum representations_](https://serde.rs/enum-representations.html)

[^serde-unknown]: [Serde, `deny_unknown_fields`](https://serde.rs/container-attrs.html#serdedeny_unknown_fields)

[^serde-map]: [`serde_json::Map`](https://docs.rs/serde_json/latest/serde_json/map/index.html)
