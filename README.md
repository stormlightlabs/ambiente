# Ambiente

Ambiente is a system for composing, performing, exploring, and listening to
generative music.

## Development

The repository uses Rust 1.88.0, Node.js 24 LTS, and pnpm 11.14.0. The Nix
shell includes the development tools and Linux libraries required by Tauri. Enter
it directly or load it with direnv:

```sh
nix-shell
# or, once per checkout:
direnv allow
```

Install the JavaScript dependencies, then run the full local check:

```sh
pnpm install
pnpm check
```

Start the web application with:

```sh
pnpm --filter @ambiente/web dev
```
