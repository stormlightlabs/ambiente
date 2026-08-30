import type { JSX } from 'solid-js';

/** Renders Ambiente's favicon artwork as the site mark. */
export function BrandMark(props: { class?: string }): JSX.Element {
	return <img aria-hidden="true" class={props.class} src="/favicon.svg" alt="" />;
}
