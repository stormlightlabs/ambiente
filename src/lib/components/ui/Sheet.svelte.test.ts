import { page, userEvent } from "@vitest/browser/context";
import { type ComponentProps, createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import Sheet from "./Sheet.svelte";

describe("Sheet", () => {
  const onClose = vi.fn();
  const renderWithProps = (overrides: Partial<ComponentProps<typeof Sheet>> = {}) => {
    render(Sheet, { open: true, onClose, side: "bottom", ...overrides });
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

  it("should apply bottom side classes by default", async () => {
    renderWithProps();

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("bottom-0");
    await expect.element(dialog).toHaveClass("left-0");
    await expect.element(dialog).toHaveClass("w-full");
    await expect.element(dialog).toHaveClass("rounded-t-xl");
  });

  it("should apply top side classes", async () => {
    renderWithProps({ side: "top" });

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("left-0");
    await expect.element(dialog).toHaveClass("top-0");
    await expect.element(dialog).toHaveClass("w-full");
    await expect.element(dialog).toHaveClass("rounded-b-xl");
  });

  it("should apply default snap point height", async () => {
    renderWithProps();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveStyle("height: 400px");
  });

  it("should apply custom snap points", async () => {
    renderWithProps({ snapPoints: ["300px", "600px"], defaultSnapPoint: "300px" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveStyle("height: 300px");
  });

  it("should show drag handle", async () => {
    renderWithProps();
    const dragHandle = page.getByRole("button", { name: /resize sheet/i });
    await expect.element(dragHandle).toBeInTheDocument();
  });

  it("should cycle through snap points when drag handle is clicked", async () => {
    renderWithProps({ snapPoints: ["300px", "600px"], defaultSnapPoint: "300px" });

    const dialog = page.getByRole("dialog");
    const dragHandle = page.getByRole("button", { name: /resize sheet/i });

    await expect.element(dialog).toHaveStyle("height: 300px");

    await userEvent.click(dragHandle);
    await expect.element(dialog).toHaveStyle("height: 600px");

    await userEvent.click(dragHandle);
    await expect.element(dialog).toHaveStyle("height: 300px");
  });

  it("should show snap point indicators when multiple snap points exist", async () => {
    renderWithProps({ snapPoints: ["300px", "600px", "900px"] });
    const indicators = page.getByRole("button", { name: /set height to/i });
    expect(indicators.elements()).toHaveLength(3);
  });

  it("should not show snap point indicators for single snap point", async () => {
    renderWithProps({ snapPoints: ["400px"] });

    const indicators = page.getByRole("button", { name: /set height to/i });
    expect(indicators.elements()).toHaveLength(0);
  });

  it("should change height when snap point indicator is clicked", async () => {
    renderWithProps({ snapPoints: ["300px", "600px"], defaultSnapPoint: "300px" });

    const dialog = page.getByRole("dialog");
    const indicator600 = page.getByRole("button", { name: "Set height to 600px" });

    await userEvent.click(indicator600);
    await expect.element(dialog).toHaveStyle("height: 600px");
  });

  it("should apply custom class", async () => {
    renderWithProps({ class: "custom-sheet" });
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("custom-sheet");
  });

  it("should render title and description", async () => {
    renderWithProps({ title: "Test Sheet", description: "This is a test description" });

    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveAttribute("aria-labelledby", "sheet-title");
    await expect.element(dialog).toHaveAttribute("aria-describedby", "sheet-description");

    const title = page.getByText("Test Sheet");
    const description = page.getByText("This is a test description");
    await expect.element(title).toBeInTheDocument();
    await expect.element(description).toBeInTheDocument();
  });

  it("should render children content", async () => {
    renderWithProps({ children: createRawSnippet(() => ({ render: () => "<p>Sheet content</p>" })) });
    const content = page.getByText("Sheet content");
    await expect.element(content).toBeInTheDocument();
  });

  it("should show close button by default", async () => {
    renderWithProps();
    const closeButton = page.getByRole("button", { name: /close sheet/i });
    await expect.element(closeButton).toBeInTheDocument();
  });

  it("should hide close button when showCloseButton is false", async () => {
    renderWithProps({ showCloseButton: false });
    const closeButton = page.getByRole("button", { name: /close sheet/i });
    await expect.element(closeButton).not.toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    renderWithProps();
    const closeButton = page.getByRole("button", { name: /close sheet/i });
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

  it("should not call onClose when sheet content is clicked", async () => {
    renderWithProps({ children: createRawSnippet(() => ({ render: () => "<p>Sheet content</p>" })) });
    const content = page.getByText("Sheet content");
    await userEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should apply dark mode classes", async () => {
    renderWithProps();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass(/dark:bg-surface-900/);
  });

  it("should have overflow-y-auto for scrollable content", async () => {
    renderWithProps();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveClass("overflow-y-auto");
  });

  it("should have max-height constraint", async () => {
    renderWithProps();
    const dialog = page.getByRole("dialog");
    await expect.element(dialog).toHaveStyle("max-height: 90vh");
  });
});
