import type { Component } from "solid-js";

import type { ContentHeading } from "./heading-anchors";

/** Frontmatter supported by Ambiente documentation pages. */
export type DocumentFrontmatter = {
  description?: string;
  order?: number;
  title?: string;
};

/** A documentation entry rendered from the canonical content directory. */
export type DocumentationEntry = {
  component: Component<Record<string, unknown>> | undefined;
  description: string;
  headings: ContentHeading[];
  html: string | undefined;
  path: string;
  slug: string;
  title: string;
};

type MarkdownModule = {
  default: string;
  frontmatter?: DocumentFrontmatter;
};

type MdxModule = {
  default: Component<Record<string, unknown>>;
  frontmatter?: DocumentFrontmatter;
  headings?: ContentHeading[];
};

const modules = import.meta.glob<MarkdownModule | MdxModule>(
  "../../content/docs/**/*.{md,mdx}",
  { eager: true },
);

/** Removes inline markup from Sätteri-rendered heading labels. */
export function textFromHeadingHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

/** Collects heading navigation from Sätteri-rendered Markdown HTML. */
export function headingsFromHtml(html: string): ContentHeading[] {
  const headings: ContentHeading[] = [];
  const pattern = /<h([1-6])\s+[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;

  for (const match of html.matchAll(pattern)) {
    const depth = Number(match[1]);
    const id = match[2];
    const label = match[3];
    if (id && label) {
      headings.push({ depth, id, text: textFromHeadingHtml(label) });
    }
  }

  return headings;
}

function slugFromPath(path: string): string {
  return path
    .replace(/^\.\.\/\.\.\/content\/docs\//, "")
    .replace(/\.(md|mdx)$/, "")
    .replace(/\/index$/, "");
}

function titleFromSlug(slug: string): string {
  const name = slug.split("/").at(-1) ?? slug;
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const entries = Object.entries(modules).map(([sourcePath, module]) => {
  const slug = slugFromPath(sourcePath);
  const frontmatter = module.frontmatter ?? {};
  const title = frontmatter.title ?? titleFromSlug(slug);
  const common = {
    description: frontmatter.description ?? `Read the ${title} guide.`,
    order: frontmatter.order ?? Number.MAX_SAFE_INTEGER,
    path: `/docs/${slug}`,
    slug,
    title,
  };

  if (typeof module.default === "string") {
    return {
      ...common,
      component: undefined,
      headings: headingsFromHtml(module.default),
      html: module.default,
    };
  }

  const mdxModule = module as MdxModule;
  return {
    ...common,
    component: mdxModule.default,
    headings: mdxModule.headings ?? [],
    html: undefined,
  };
});

/** All documentation pages in stable navigation order. */
export const documentation = entries
  .sort(
    (left, right) =>
      left.order - right.order || left.title.localeCompare(right.title),
  )
  .map((entry): DocumentationEntry => ({
    component: entry.component,
    description: entry.description,
    headings: entry.headings,
    html: entry.html,
    path: entry.path,
    slug: entry.slug,
    title: entry.title,
  }));

/** Finds a documentation page by its content-derived slug. */
export function findDocumentation(
  slug: string,
): DocumentationEntry | undefined {
  return documentation.find((entry) => entry.slug === slug);
}
