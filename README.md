# Ambiente

Ambiente is a system for composing, performing, exploring, and listening to
generative music.

## Development

The repository uses Rust 1.88.0, Node.js 24 LTS, and pnpm 11.14.0. Install the
JavaScript tools, then run the full local check:

```sh
pnpm install
pnpm check
```

Start the web application with:

```sh
pnpm --filter @ambiente/web dev
```
