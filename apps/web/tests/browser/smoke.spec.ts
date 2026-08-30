import { expect, test } from "@playwright/test";

test("landing page presents the product and Studio path", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Compose the system",
  );
  await expect(page.getByRole("link", { name: "Open Studio" })).toHaveAttribute(
    "href",
    "/studio",
  );
});

test("documentation renders canonical Markdown", async ({ page }) => {
  await page.goto("/docs/architecture");

  await expect(
    page.getByRole("heading", { level: 1, name: "Architecture" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "On this page" }),
  ).toContainText("System shape");

  await page.goto("/docs/solid-components");
  await expect(page.getByText("Rotation: 0 steps")).toBeVisible();
  await page.getByRole("button", { name: "Rotate pattern" }).click();
  await expect(page.getByText("Rotation: 1 steps")).toBeVisible();
});

test("Studio boots against the temporary facade without WASM", async ({
  page,
}) => {
  await page.goto("/studio");

  await expect(
    page.getByRole("heading", { level: 1, name: "Pattern workspace" }),
  ).toBeVisible();
  await expect(page.getByText("Studio is in preview.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
});
