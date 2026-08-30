---
title: Document format
description: Stable IDs, canonical JSON, schema migration, and compatibility rules.
order: 3
---

# Document format

Ambiente stores musical state in a versioned UTF-8 JSON document. The format
owns object identity, serialization, migration, and validation rules. Musical
concepts belong to the [composition model](composition-model.md), while audio
runtime state belongs to the [audio design](audio.md).

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

Ambiente needs decentralized uniqueness, not sortable IDs. The `uuid` project
recommends v4 when an application only needs unique identifiers and v7 when
sorting or database locality matters.[^uuid] Creation time is not part of an
Ambiente object's identity, so v7 adds semantics that the model does not need.

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

JSON works in browsers, has mature Serde support, remains readable in source
control, and supports migration through `serde_json::Value`.[^serde] A future
`.ambiente` project container may bundle assets, but it must contain or refer to
this versioned document instead of defining another musical schema.

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

Ambiente exposes one canonical encoder. Code outside that API does not call
Serde directly to write project files. This keeps formatting and wire-format
choices in one place.

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

Start with `serde_json::Value` transformations instead of maintaining complete
Rust models for every historical schema. If one migration becomes easier to
write and review with a typed historical wire struct, add that struct for the
migration alone.

## Compatibility tests

The document format requires tests that prove:

- entity IDs round-trip in canonical form and reject nil UUIDs;
- a minimal document writes `format = "ambiente"` and the current schema version;
- save, load, and save again produce a semantically equal, canonically stable
  document;
- unknown fields and future schema versions are rejected; and
- each migration advances one version without changing its input fixture.

These tests protect the file format. Do not refresh a fixture after a dependency
update until the resulting format change has been understood and accepted.

[^uuid]: [`uuid`, _Working with different UUID versions_](https://docs.rs/uuid/latest/uuid/#working-with-different-uuid-versions)

[^uuid-v4]: [`uuid`, UUIDv4 implementation](https://docs.rs/uuid/latest/src/uuid/v4.rs.html)

[^serde]: [Serde](https://serde.rs/) and [`serde_json`](https://docs.rs/serde_json/latest/serde_json/)

[^serde-enums]: [Serde, _Enum representations_](https://serde.rs/enum-representations.html)

[^serde-unknown]: [Serde, `deny_unknown_fields`](https://serde.rs/container-attrs.html#serdedeny_unknown_fields)

[^serde-map]: [`serde_json::Map`](https://docs.rs/serde_json/latest/serde_json/map/index.html)
