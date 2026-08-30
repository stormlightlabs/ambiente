# Ambiente

Ambiente is a system for composing, performing, exploring, and listening to
generative music.

The reboot is in its foundation phase. Start with:

- [roadmap](docs/roadmap.md)
- [architecture](docs/architecture.md)
- [composition model and glossary](docs/composition-model.md)
- [audio architecture](docs/audio.md)
- [implementation checklist](TODO.md)

## Development

The repository uses Rust 1.88.0, Node.js 24 LTS, and pnpm 11.14.0. Install the
JavaScript tools, then run the full local check:

```sh
pnpm install
pnpm check
```

See [Architecture: Repository and workspace](docs/architecture.md#repository-and-workspace)
for individual formatting, linting, and test commands.
