import { page, userEvent } from "@vitest/browser/context";
import { type ComponentProps, createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import Modal from "./Modal.svelte";

describe("Modal", () => {
  const onClose = vi.fn();
  const renderWithProps = (overrides: Partial<ComponentProps<typeof Modal>> = {}) => {
    render(Modal, { open: true, onClose, ...overrides });
  };

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

  it("should apply size classes correctly", async () => {
    renderWithProps({ size: "lg" });

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-lg");
  });

  it("should apply sm size variant", async () => {
    renderWithProps({ size: "sm" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-sm");
  });

  it("should apply md size variant", async () => {
    renderWithProps({ size: "md" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-md");
  });

  it("should apply lg size variant", async () => {
    renderWithProps({ size: "lg" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-lg");
  });

  it("should apply xl size variant", async () => {
    renderWithProps({ size: "xl" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-xl");
  });

  it("should apply full size variant", async () => {
    renderWithProps({ size: "full" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-6xl");
  });

  it("should default to medium size", async () => {
    renderWithProps();

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-md");
  });

  it("should combine size and custom classes", async () => {
    renderWithProps({ size: "xl", class: "custom-modal" });

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("max-w-xl");
    await expect.element(dialog).toHaveClass("custom-modal");
  });

  it("should render title and description", async () => {
    renderWithProps({ title: "Test Modal", description: "This is a test description" });

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
    await expect.element(dialog).toHaveAttribute("aria-describedby", "dialog-description");

    const title = page.getByText("Test Modal");
    const description = page.getByText("This is a test description");
    await expect.element(title).toBeInTheDocument();
    await expect.element(description).toBeInTheDocument();
  });

  it("should render children content", async () => {
    renderWithProps({ children: createRawSnippet(() => ({ render: () => "<p>Modal content</p>" })) });

    const content = page.getByText("Modal content");
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

  it("should not call onClose when modal content is clicked", async () => {
    renderWithProps({ children: createRawSnippet(() => ({ render: () => "<p>Modal content</p>" })) });

    const content = page.getByText("Modal content");
    await userEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });
});
