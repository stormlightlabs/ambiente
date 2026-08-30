import type { JSX } from "solid-js";

/** Ambiente's compact process-wave mark. */
export function BrandMark(props: { class?: string }): JSX.Element {
  return (
    <svg aria-hidden="true" class={props.class} viewBox="0 0 48 48" fill="none">
      <path d="M4 24h40" stroke="currentColor" stroke-opacity=".18" />
      <path
        d="M5 30c6-16 12-16 18 0s12 16 20 0"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="3"
      />
      <circle cx="12" cy="19" r="2.5" fill="currentColor" />
      <circle cx="35" cy="35" r="2.5" fill="currentColor" />
    </svg>
  );
}
