import { expect, test } from '@playwright/test';

test('landing page presents the product and Studio path', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Algorithmic Ambient Composition');
	await expect(page.locator('.wordmark__mark')).toHaveAttribute('src', '/favicon.svg');
	await expect(page.getByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/studio');
	await expect(page.locator('.site-footer__links').getByRole('heading')).toHaveCount(3);
	await page.getByRole('button', { name: 'Use dark mode' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('site player keeps playing across navigation', async ({ page }) => {
	await page.goto('/');
	const player = page.getByRole('complementary', { name: 'Site music player' });
	const play = player.getByRole('button', { name: 'Play site music' });
	await expect(play).toBeEnabled();
	await play.click();
	await expect(player.getByText('Seed 5048415345000001')).toBeVisible();
	await expect(player.getByRole('button', { name: 'Pause site music' })).toBeVisible();
	await expect(player.getByLabel('Site player volume')).toHaveValue('0.8');

	await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Docs' }).click();
	await expect(page).toHaveURL(/\/docs$/);
	await expect(player.getByRole('button', { name: 'Pause site music' })).toBeVisible();
});

test('Listen mode browses first-party pieces without composition controls', async ({ page }) => {
	await page.goto('/listen');

	await expect(page.getByRole('heading', { name: 'Music for the time you are in' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Phase/ })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: /Drone/ }).click();
	await expect(page.getByRole('heading', { level: 2, name: 'Drone' })).toBeVisible();
	await expect(page.getByRole('slider', { name: 'Warmth' })).toHaveValue('62');
	await page.getByRole('button', { name: 'Rest', exact: true }).click();
	await expect(page.getByRole('slider', { name: 'Warmth' })).toHaveValue('82');
	await expect(page.getByRole('button', { name: 'Rest', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: '30 min' }).click();
	await expect(page.getByRole('button', { name: '30 min' })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: /Artwork responding/ })).toHaveClass(/is-playing/);
	await expect(page.locator('.listener-artwork__event').first()).toBeVisible();
	await page.getByRole('button', { name: 'New variation' }).click();
	await expect(page.getByText(/Seed|BPM|material|voice/i)).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Site music player' })).toHaveCount(0);
});

test('examples present musical primitives and lead to the Three Studies', async ({ page }) => {
	await page.goto('/examples');
	for (const example of ['Phrase', 'Matrix', 'Piano', 'Voice', 'Sound']) {
		await expect(page.getByLabel(`${example} playable example`)).toBeVisible();
	}
	await expect(page.getByRole('link', { name: 'Listen to the Three Studies' })).toHaveAttribute(
		'href',
		'/docs/three-studies'
	);
});

test('documentation renders canonical Markdown', async ({ page }) => {
	await page.goto('/docs/architecture');

	await expect(page.getByRole('heading', { level: 1, name: 'Architecture' })).toBeVisible();
	const tableOfContents = page.getByRole('navigation', { name: 'On this page' });
	await expect(tableOfContents).toContainText('System shape');
	const webSection = tableOfContents.getByRole('link', { name: 'Web and desktop' });
	await webSection.click();
	await expect
		.poll(() => page.locator('#web-and-desktop').evaluate((heading) => heading.getBoundingClientRect().top))
		.toBeLessThan(40);
	await expect(webSection).toHaveAttribute('aria-current', 'location');
});

test('embedded Studies and the global player share playback state', async ({ page }) => {
	await page.goto('/docs/three-studies');
	const pattern = page.getByRole('region', { name: 'Pattern Study study player' });
	const player = page.getByRole('complementary', { name: 'Site music player' });
	await expect(
		pattern.getByText('One metric cell transformed across direction, register, density, and pace.')
	).toBeVisible();
	await pattern.getByRole('button', { name: 'Play study' }).click();
	await expect(player.getByRole('button', { name: 'Pause site music' })).toBeVisible();
	await expect(player.getByRole('combobox')).toHaveValue('pattern');
	await expect(pattern.getByRole('button', { name: 'Stop' })).toBeVisible();
	await player.getByRole('button', { name: 'Stop site music' }).click();
	await expect(pattern.getByRole('button', { name: 'Play study' })).toBeVisible();
	await pattern.getByRole('button', { name: 'Next variation' }).click();
	await expect(pattern.getByText('Seed 5041545445520002')).toBeVisible();
});

test('top-bar command palette searches the generated Pagefind index', async ({ page }) => {
	await page.goto('/docs');
	await page.getByRole('button', { name: /Open documentation search/ }).click();
	await page.getByRole('combobox', { name: 'Search documentation' }).fill('event engine');
	await expect(page.getByLabel('Search results')).toContainText('Architecture');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('Studio loads Rust events and the browser transport', async ({ page }) => {
	await page.goto('/studio');

	await expect(page.getByRole('heading', { level: 1, name: 'Play and record' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Local pieces' })).toBeVisible();
	await expect(page.getByText('Format 3')).toBeVisible();
	await expect(page.getByLabel('Playback volume')).toHaveValue('0.8');

	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
	await page.getByLabel('Seek position in seconds').fill('8');
	await page.getByLabel('Seek position in seconds').press('Tab');
	await expect(page.getByLabel('Seek position in seconds')).toHaveValue('8');

	await page.getByLabel('Composition seed').fill('000000000000002b');
	await page.getByLabel('Composition seed').press('Tab');
	await page.getByLabel('Tempo in beats per minute').fill('96');
	await page.getByLabel('Tempo in beats per minute').press('Tab');
	await page.getByRole('button', { name: /^Save$/ }).click();
	await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
	await page.reload();
	await expect(page.getByLabel('Composition seed')).toHaveValue('000000000000002b');
	await expect(page.getByLabel('Tempo in beats per minute')).toHaveValue('96');
});

test('Studio remains vertically scrollable on a narrow screen', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/studio');
	await expect(page.getByLabel('Voice sound')).toBeVisible();
	const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
	const viewportHeight = await page.evaluate(() => document.documentElement.clientHeight);
	expect(scrollHeight).toBeGreaterThan(viewportHeight);
	await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
	await expect(page.getByLabel('Voice inspector')).toBeInViewport();
});

test('Studio edits voices and records piano input as a phrase', async ({ page }) => {
	await page.goto('/studio');
	await expect(page.getByLabel('Voice sound')).toBeVisible();

	await page.getByLabel('Voice sound').selectOption('glass');
	await expect(page.getByLabel('Voice sound')).toHaveValue('glass');

	await page.getByRole('button', { name: 'Record phrase' }).click();
	await page.keyboard.down('a');
	await page.waitForTimeout(80);
	await page.keyboard.up('a');
	await page.getByRole('button', { name: 'Stop recording' }).click();

	await expect(page.getByRole('heading', { name: 'Recording 1' })).toBeVisible();
	await expect(page.getByLabel('Voice material')).toHaveValue(/.+/);
	await expect(page.getByLabel('1 recorded note')).toBeVisible();

	await page.getByRole('button', { name: 'Add voice' }).click();
	await expect(page.getByRole('heading', { name: 'Voice 2' })).toBeVisible();
	await page.getByRole('button', { name: '+ Phrase' }).click();
	await expect(page.getByRole('button', { name: 'Phrase 2 Phrase' })).toBeVisible();
});

test('Studio edits and plays a canonical matrix', async ({ page }) => {
	await page.goto('/studio');
	await expect(page.getByRole('button', { name: '+ Matrix' })).toBeVisible();

	await page.getByRole('button', { name: '+ Matrix' }).click();
	await page.getByRole('button', { name: 'Matrix', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Build a matrix pattern' })).toBeVisible();
	const cell = page.getByRole('button', { name: 'C5, step 1', exact: true });
	await cell.click();
	await expect(cell).toHaveAttribute('aria-pressed', 'true');
	await page.getByLabel('Matrix step count').selectOption('16');
	await page.getByLabel('Matrix subdivision').selectOption('1/4');
	await expect(page.getByRole('button', { name: 'C5, step 16' })).toBeVisible();

	await page.getByLabel('Voice material').selectOption({ label: 'Matrix 2' });
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: /^Save$/ }).click();
	await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
	await page.reload();
	await page.getByRole('button', { name: 'Matrix 2 Matrix' }).click();
	await page.getByRole('button', { name: 'Matrix', exact: true }).click();
	await expect(page.getByRole('button', { name: 'C5, step 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
