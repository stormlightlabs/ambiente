# Ambiente

Ambiente is a system for composing, performing, exploring, and listening to
generative music.

The reboot is building the product shell around a deterministic Rust composition
core. Start with:

- [roadmap](ROADMAP.md)
- [architecture](apps/web/content/docs/architecture.md)
- [document format](apps/web/content/docs/document-format.md)
- [composition model and glossary](apps/web/content/docs/composition-model.md)
- [audio architecture](apps/web/content/docs/audio.md)
- [implementation checklist](TODO.md)
- [changelog](CHANGELOG.md)

## Development

The repository uses Rust 1.88.0, Node.js 24 LTS, and pnpm 11.14.0. Install the
JavaScript tools, then run the full local check:

```sh
pnpm install
pnpm check
```

See
[Architecture: Repository and workspace](apps/web/content/docs/architecture.md#repository-and-workspace)
for individual formatting, linting, and test commands.
