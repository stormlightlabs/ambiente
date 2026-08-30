import { expect, test } from '@playwright/test';

test('landing page presents the product and Studio path', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Compose the system');
	await expect(page.locator('.wordmark__mark')).toHaveAttribute('src', '/favicon.svg');
	await expect(page.getByRole('link', { name: 'Open Studio' })).toHaveAttribute('href', '/studio');
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

test('Studio boots against the temporary facade without WASM', async ({ page }) => {
	await page.goto('/studio');

	await expect(page.getByRole('heading', { level: 1, name: 'Pattern workspace' })).toBeVisible();
	await expect(page.getByText('Studio is in preview.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();
});
