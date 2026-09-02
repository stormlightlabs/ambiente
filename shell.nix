{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    pkg-config
  ];

  buildInputs = with pkgs; [
    cargo
    clippy
    rust-analyzer
    rustc
    rustfmt

    nodejs_24
    pnpm

    atk
    cairo
    dbus
    gdk-pixbuf
    glib
    gtk3
    harfbuzz
    libayatana-appindicator
    librsvg
    libsoup_3
    openssl
    pango
    webkitgtk_4_1
    zlib
    zlib.dev
  ];
}
