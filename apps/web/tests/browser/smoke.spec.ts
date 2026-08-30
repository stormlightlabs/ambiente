import { expect, test } from '@playwright/test';

test('landing page presents the product and Studio path', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Algorithmic Composition');
	await expect(page.locator('.wordmark__mark')).toHaveAttribute('src', '/favicon.svg');
	await expect(page.getByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/studio');
	await expect(page.locator('.site-footer__links').getByRole('heading')).toHaveCount(3);
	await page.getByRole('button', { name: 'Use dark mode' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
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

	await page.goto('/docs/solid-components');
	await expect(page.getByRole('heading', { level: 1, name: 'Playable examples' })).toBeVisible();
	await expect(page.getByLabel('Phrase playable example')).toBeVisible();
	await expect(page.getByLabel('Matrix playable example')).toBeVisible();
	await page.getByRole('button', { name: 'Play phrase' }).click();
	await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
});

test('documentation search uses the generated Pagefind index', async ({ page }) => {
	await page.goto('/docs');
	await page.getByRole('searchbox', { name: 'Search documentation' }).fill('event engine');
	await expect(page.getByLabel('Search results')).toContainText('Architecture');
});

test('Studio loads Rust events and the browser transport', async ({ page }) => {
	await page.goto('/studio');

	await expect(page.getByRole('heading', { level: 1, name: 'Play and record' })).toBeVisible();
	await expect(page.getByText('Ready to play')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Local pieces' })).toBeVisible();
	await expect(page.getByText('Format 2')).toBeVisible();

	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeEnabled();
	await page.getByRole('button', { name: 'Pause' }).click();
	await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();
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

test('Studio edits voices and records piano input as a phrase', async ({ page }) => {
	await page.goto('/studio');
	await expect(page.getByText('Ready to play')).toBeVisible();

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
	await expect(page.getByText('Ready to play')).toBeVisible();

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
	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeEnabled();
	await page.getByRole('button', { name: /^Save$/ }).click();
	await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
	await page.reload();
	await page.getByRole('button', { name: 'Matrix 2 Matrix' }).click();
	await page.getByRole('button', { name: 'Matrix', exact: true }).click();
	await expect(page.getByRole('button', { name: 'C5, step 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
