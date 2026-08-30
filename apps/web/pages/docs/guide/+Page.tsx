import { Dynamic } from "solid-js/web";
import { For, Show, type JSX } from "solid-js";
import { usePageContext } from "vike-solid/usePageContext";

import { documentation, findDocumentation } from "../../../src/content/docs";

const mdxComponents = {
  a: (props: JSX.IntrinsicElements["a"]) => <a {...props} />,
  blockquote: (props: JSX.IntrinsicElements["blockquote"]) => (
    <blockquote {...props} />
  ),
  code: (props: JSX.IntrinsicElements["code"]) => <code {...props} />,
  em: (props: JSX.IntrinsicElements["em"]) => <em {...props} />,
  h1: (props: JSX.IntrinsicElements["h1"]) => <h1 {...props} />,
  h2: (props: JSX.IntrinsicElements["h2"]) => <h2 {...props} />,
  h3: (props: JSX.IntrinsicElements["h3"]) => <h3 {...props} />,
  h4: (props: JSX.IntrinsicElements["h4"]) => <h4 {...props} />,
  h5: (props: JSX.IntrinsicElements["h5"]) => <h5 {...props} />,
  h6: (props: JSX.IntrinsicElements["h6"]) => <h6 {...props} />,
  hr: (props: JSX.IntrinsicElements["hr"]) => <hr {...props} />,
  img: (props: JSX.IntrinsicElements["img"]) => <img {...props} />,
  li: (props: JSX.IntrinsicElements["li"]) => <li {...props} />,
  ol: (props: JSX.IntrinsicElements["ol"]) => <ol {...props} />,
  p: (props: JSX.IntrinsicElements["p"]) => <p {...props} />,
  pre: (props: JSX.IntrinsicElements["pre"]) => <pre {...props} />,
  strong: (props: JSX.IntrinsicElements["strong"]) => <strong {...props} />,
  table: (props: JSX.IntrinsicElements["table"]) => <table {...props} />,
  tbody: (props: JSX.IntrinsicElements["tbody"]) => <tbody {...props} />,
  td: (props: JSX.IntrinsicElements["td"]) => <td {...props} />,
  th: (props: JSX.IntrinsicElements["th"]) => <th {...props} />,
  thead: (props: JSX.IntrinsicElements["thead"]) => <thead {...props} />,
  tr: (props: JSX.IntrinsicElements["tr"]) => <tr {...props} />,
  ul: (props: JSX.IntrinsicElements["ul"]) => <ul {...props} />,
};

export default function Page() {
  const pageContext = usePageContext();
  const document = () => findDocumentation(pageContext.routeParams.slug ?? "");
  const pageHeadings = () =>
    document()?.headings.filter((heading) => heading.depth > 1) ?? [];

  return (
    <Show
      when={document()}
      fallback={<p class="not-found">Documentation page not found.</p>}
    >
      {(current) => (
        <div class="docs-layout">
          <aside class="docs-sidebar" aria-label="Documentation">
            <a class="docs-sidebar__index" href="/docs">
              Documentation
            </a>
            <nav>
              <For each={documentation}>
                {(entry) => (
                  <a
                    href={entry.path}
                    aria-current={
                      entry.slug === current().slug ? "page" : undefined
                    }
                  >
                    {entry.title}
                  </a>
                )}
              </For>
            </nav>
          </aside>

          <article class="prose">
            <Show
              when={current().component}
              fallback={<div innerHTML={current().html ?? ""} />}
            >
              {(component) => (
                <Dynamic component={component()} components={mdxComponents} />
              )}
            </Show>
          </article>

          <Show when={pageHeadings().length > 0}>
            <aside class="page-nav">
              <p>On this page</p>
              <nav aria-label="On this page">
                <For each={pageHeadings()}>
                  {(heading) => (
                    <a
                      classList={{ "page-nav__nested": heading.depth > 2 }}
                      href={`#${heading.id}`}
                    >
                      {heading.text}
                    </a>
                  )}
                </For>
              </nav>
            </aside>
          </Show>
        </div>
      )}
    </Show>
  );
}
