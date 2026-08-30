import { expect, test } from '@playwright/test';

test('landing page presents the product and Studio path', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Compose the system');
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
	await expect(page.getByText('Rotation: 0 steps')).toBeVisible();
	await page.getByRole('button', { name: 'Rotate pattern' }).click();
	await expect(page.getByText('Rotation: 1 steps')).toBeVisible();
});

test('documentation search uses the generated Pagefind index', async ({ page }) => {
	await page.goto('/docs');
	await page.getByRole('searchbox', { name: 'Search documentation' }).fill('event engine');
	await expect(page.getByLabel('Search results')).toContainText('Architecture');
});

test('Studio loads Rust events and the browser transport', async ({ page }) => {
	await page.goto('/studio');

	await expect(page.getByRole('heading', { level: 1, name: 'Pattern workspace' })).toBeVisible();
	await expect(page.getByText('Rust events are ready to play.')).toBeVisible();
	await expect(page.getByText('Rust audio ready')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Local pieces' })).toBeVisible();
	await expect(page.getByText('Schema 2')).toBeVisible();

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
