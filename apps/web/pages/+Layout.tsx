import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { usePageContext } from "vike-solid/usePageContext";

import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/literata";
import "virtual:uno.css";

import { BrandMark } from "../src/components/BrandMark";
import "../src/styles/global.css";

const navigation = [
  { href: "/docs", label: "Docs" },
  { href: "/learn", label: "Learn" },
  { href: "/examples", label: "Examples" },
  { href: "/studio", label: "Studio" },
];

/** Shared application shell for public, documentation, and Studio routes. */
export function Layout(props: { children?: JSX.Element }) {
  const pageContext = usePageContext();
  const pathname = () => pageContext.urlPathname;
  const isStudio = () => pathname().startsWith("/studio");

  return (
    <div classList={{ "site-frame": true, "site-frame--studio": isStudio() }}>
      <a class="skip-link" href="#main-content">
        Skip to content
      </a>
      <header class="site-header">
        <a class="wordmark" href="/" aria-label="Ambiente home">
          <BrandMark class="wordmark__mark" />
          <span>ambiente</span>
        </a>
        <nav class="site-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = () =>
              item.href === "/"
                ? pathname() === item.href
                : pathname().startsWith(item.href);
            return (
              <a href={item.href} aria-current={active() ? "page" : undefined}>
                {item.label}
              </a>
            );
          })}
        </nav>
      </header>
      <main id="main-content" class="site-main">
        {props.children}
      </main>
      <Show when={!isStudio()}>
        <footer class="site-footer">
          <p>Compose repeatable music that keeps changing.</p>
          <a href="https://github.com/stormlightlabs/ambiente">
            Source on GitHub
          </a>
        </footer>
      </Show>
    </div>
  );
}
