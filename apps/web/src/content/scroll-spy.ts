const HEADING_OFFSET_TOLERANCE = 4;

/** A document heading's absolute position and configured scroll offset. */
export type HeadingPosition = { id: string; scrollMarginTop: number; top: number };

/** The scroll and size values used to select the current section. */
export type ViewportPosition = { documentHeight: number; height: number; scrollY: number };

/** Finds the section at the viewport's reading position. */
export function findActiveHeading(headings: HeadingPosition[], viewport: ViewportPosition): string | null {
	if (headings.length === 0 || viewport.scrollY < 1) return null;

	if (viewport.scrollY + viewport.height >= viewport.documentHeight - 1) {
		return headings.at(-1)?.id ?? null;
	}

	let activeHeading: string | null = null;
	for (const heading of headings) {
		if (heading.top > viewport.scrollY + heading.scrollMarginTop + HEADING_OFFSET_TOLERANCE) break;
		activeHeading = heading.id;
	}

	return activeHeading;
}

/** Watches page position and reports the heading for the section being read. */
export function startScrollSpy(headings: HTMLElement[], onChange: (activeHeading: string | null) => void): () => void {
	let animationFrame: number | undefined;
	let previousHeading: string | null | undefined;

	const update = () => {
		animationFrame = undefined;
		const scrollY = window.scrollY;
		const activeHeading = findActiveHeading(
			headings.map((heading) => ({
				id: heading.id,
				scrollMarginTop: Number.parseFloat(getComputedStyle(heading).scrollMarginTop) || 0,
				top: heading.getBoundingClientRect().top + scrollY
			})),
			{ documentHeight: document.documentElement.scrollHeight, height: window.innerHeight, scrollY }
		);

		if (activeHeading !== previousHeading) {
			previousHeading = activeHeading;
			onChange(activeHeading);
		}
	};

	const scheduleUpdate = () => {
		if (animationFrame === undefined) animationFrame = requestAnimationFrame(update);
	};

	update();
	window.addEventListener('scroll', scheduleUpdate, { passive: true });
	window.addEventListener('resize', scheduleUpdate);

	return () => {
		window.removeEventListener('scroll', scheduleUpdate);
		window.removeEventListener('resize', scheduleUpdate);
		if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
	};
}
