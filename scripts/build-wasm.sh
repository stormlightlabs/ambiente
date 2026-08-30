#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/packages/wasm/generated"

if ! command -v wasm-bindgen >/dev/null 2>&1; then
  echo "wasm-bindgen CLI is required; install wasm-bindgen-cli 0.2.127" >&2
  exit 1
fi

cargo build --manifest-path "$root/Cargo.toml" --package ambiente-wasm --target wasm32-unknown-unknown --release
rm -rf "$out"
wasm-bindgen \
  --target web \
  --typescript \
  --out-dir "$out" \
  --out-name ambiente_wasm \
  "$root/target/wasm32-unknown-unknown/release/ambiente_wasm.wasm"
