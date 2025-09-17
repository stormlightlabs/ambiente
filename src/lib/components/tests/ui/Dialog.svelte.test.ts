import Dialog from "$components/ui/Dialog.svelte";
import { page, userEvent } from "@vitest/browser/context";
import { type ComponentProps, createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

describe("Dialog", () => {
  const onClose = vi.fn();
  const renderWithProps = (overrides: Partial<ComponentProps<typeof Dialog>> = {}) =>
    render(Dialog, { open: true, onClose, ...overrides });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should not render when closed", async () => {
    renderWithProps({ open: false });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).not.toBeInTheDocument();
  });

  it("should render when open", async () => {
    renderWithProps();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toBeInTheDocument();
    await expect.element(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("should render title and description", async () => {
    renderWithProps({ title: "Test Dialog", description: "This is a test description" });

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    await expect.element(dialog).toHaveAttribute("aria-describedby", "dialog-description");

    const title = page.getByText("Test Dialog");
    const description = page.getByText("This is a test description");
    await expect.element(title).toBeInTheDocument();
    await expect.element(description).toBeInTheDocument();
  });

  it("should render children content", async () => {
    renderWithProps({ children: createRawSnippet(() => ({ render: () => "<p>Dialog content</p>" })) });

    const content = page.getByText("Dialog content");
    await expect.element(content).toBeInTheDocument();
  });

  it("should show close button by default", async () => {
    renderWithProps();
    const closeButton = page.getByRole("button", { name: /close dialog/i });
    await expect.element(closeButton).toBeInTheDocument();
  });

  it("should hide close button when showCloseButton is false", async () => {
    renderWithProps({ showCloseButton: false });
    const closeButton = page.getByRole("button", { name: /close dialog/i });
    await expect.element(closeButton).not.toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    renderWithProps();
    const closeButton = page.getByRole("button", { name: /close dialog/i });
    await userEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("should call onClose when Escape key is pressed", async () => {
    renderWithProps();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("should not call onClose when Escape key is pressed and closeOnEscape is false", async () => {
    renderWithProps({ closeOnEscape: false });
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should not call onClose when backdrop is clicked and closeOnOutsideClick is false", async () => {
    renderWithProps({ closeOnOutsideClick: false });
    const backdrop = page.getByRole("presentation");
    await userEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should not call onClose when dialog content is clicked", async () => {
    renderWithProps({ children: createRawSnippet(() => ({ render: () => "<p>Dialog content</p>" })) });
    const content = page.getByText("Dialog content");
    await userEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should apply custom class", async () => {
    renderWithProps({ class: "custom-dialog" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("custom-dialog");
  });

  it("should apply dark mode classes", async () => {
    renderWithProps();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass(/dark:bg-surface-900/);
  });
});
