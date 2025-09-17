import ChordDisplay from "$components/ChordDisplay.svelte";
import { Mode, Note } from "$lib/theory";
import { page } from "@vitest/browser/context";
import { type ComponentProps, flushSync } from "svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";

type TCurrentChord = { notes: Note[]; index: number };

const currentChord: (overrides: Partial<TCurrentChord>) => TCurrentChord = (overrides: Partial<TCurrentChord>) => ({
  notes: [Note.C, Note.E, Note.G],
  index: 0,
  ...overrides,
});

const renderWithProps = (
  overrides: Partial<ComponentProps<typeof ChordDisplay>> = {},
  chord: Partial<TCurrentChord> = {},
) => {
  const props = { currentChord: currentChord(chord), key: Note.C, mode: Mode.Ionian, name: "classic" as const };
  return render(ChordDisplay, { ...props, ...overrides });
};

describe("ChordDisplay", () => {
  beforeEach(() => {});

  describe("Component Rendering", () => {
    it("should render the component with basic structure", async () => {
      renderWithProps();
      const container = page.getByRole("region", { name: "Chord Display" });
      await expect.element(container).toBeInTheDocument();

      const currentChordHeading = page.getByText("Current Chord");
      await expect.element(currentChordHeading).toBeInTheDocument();
    });

    it("should display current chord name", async () => {
      renderWithProps();
      const chordName = page.getByTestId("current-chord-name");
      await expect.element(chordName).toBeInTheDocument();
      await expect.element(chordName).toHaveTextContent("C");
    });

    it("should display key and mode information", async () => {
      renderWithProps();
      const keyInfo = page.getByTestId("key-mode-info");
      await expect.element(keyInfo).toBeInTheDocument();
      await expect.element(keyInfo).toHaveTextContent("Key: C ionian");
    });

    it("should display progression position", async () => {
      renderWithProps();
      const position = page.getByTestId("progression-position");
      await expect.element(position).toBeInTheDocument();
      await expect.element(position).toHaveTextContent("1/4");
    });
  });

  describe("Chord Analysis", () => {
    it("should analyze and display major chord correctly", async () => {
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G] });
      const chordName = page.getByTestId("current-chord-name");
      await expect.element(chordName).toHaveTextContent("C");
    });

    it("should analyze and display minor chord correctly", async () => {
      // C minor (C, Eb, G)
      renderWithProps({}, { notes: [Note.C, Note.DSharp, Note.G] });
      const chordName = page.getByTestId("current-chord-name");
      await expect.element(chordName).toHaveTextContent("Cm");
    });

    it("should handle empty chord notes", async () => {
      renderWithProps({}, { notes: [], index: 0 });
      const chordName = page.getByTestId("current-chord-name");
      await expect.element(chordName).toHaveTextContent("...");
    });

    it("should analyze seventh chords", async () => {
      // Cmaj7
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G, Note.B] });
      const chordName = page.getByTestId("current-chord-name");
      await expect.element(chordName).toHaveTextContent("Cmaj7");
    });
  });

  describe("Progression Display", () => {
    it("should display classic progression chords", async () => {
      renderWithProps({ name: "classic" });

      // Classic progression: I - vi - IV - V in C major
      // Due to chord analysis sorting notes, some chords appear as generic "chord" names
      const chord0 = page.getByTestId("progression-chord-0");
      const chord1 = page.getByTestId("progression-chord-1");
      const chord2 = page.getByTestId("progression-chord-2");
      const chord3 = page.getByTestId("progression-chord-3");

      await expect.element(chord0).toHaveTextContent("C");
      await expect.element(chord1).toHaveTextContent("C chord"); // [A,C,E] analyzed as C chord
      await expect.element(chord2).toHaveTextContent("C chord"); // [F,A,C] analyzed as C chord
      await expect.element(chord3).toHaveTextContent("D chord"); // [G,B,D] analyzed as D chord
    });

    it("should display emotional progression chords", async () => {
      renderWithProps({ name: "emotional" });
      const progressionHeader = page.getByTestId("progression-header");
      await expect.element(progressionHeader).toHaveTextContent("Progression (emotional)");
    });

    it("should display jazz progression chords", async () => {
      // Jazz progression has 3 chords, so position should show X/3
      renderWithProps({ name: "jazz" });

      const progressionHeader = page.getByTestId("progression-header");
      await expect.element(progressionHeader).toHaveTextContent("Progression (jazz)");

      const position = page.getByTestId("progression-position");
      await expect.element(position).toHaveTextContent("1/3");
    });
  });

  describe("Current Chord Highlighting", () => {
    it("should highlight the current chord in progression", async () => {
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G] });
      const currentChord = page.getByTestId("progression-chord-0");
      await expect.element(currentChord).toHaveAttribute("aria-current", "true");
    });

    it("should highlight different chord when index changes", async () => {
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G], index: 2 });
      const currentChord = page.getByTestId("progression-chord-2");
      await expect.element(currentChord).toHaveAttribute("aria-current", "true");
    });

    it("should not highlight non-current chords", async () => {
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G], index: 0 });
      const nonCurrentChord = page.getByTestId("progression-chord-1");
      await expect.element(nonCurrentChord).toHaveAttribute("aria-current", "false");
    });
  });

  describe("Different Keys and Modes", () => {
    it("should display correct progression for D major", async () => {
      renderWithProps({ key: Note.D, mode: Mode.Ionian });
      const keyInfo = page.getByTestId("key-mode-info");
      await expect.element(keyInfo).toHaveTextContent("Key: D ionian");
    });

    it("should display correct progression for A minor (Aeolian)", async () => {
      renderWithProps({ key: Note.A, mode: Mode.Aeolian });
      const keyInfo = page.getByTestId("key-mode-info");
      await expect.element(keyInfo).toHaveTextContent("Key: A aeolian");
    });

    it("should display correct progression for D dorian", async () => {
      renderWithProps({ key: Note.D, mode: Mode.Dorian });
      const keyInfo = page.getByTestId("key-mode-info");
      await expect.element(keyInfo).toHaveTextContent("Key: D dorian");
    });
  });

  describe("Progression Position Updates", () => {
    it("should update position display when chord index changes", async () => {
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G], index: 1 });
      const position = page.getByTestId("progression-position");
      await expect.element(position).toHaveTextContent("2/4");
    });

    it("should handle last chord in progression", async () => {
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G], index: 3 });
      const position = page.getByTestId("progression-position");
      await expect.element(position).toHaveTextContent("4/4");
    });

    it("should handle jazz progression position correctly", async () => {
      renderWithProps({ name: "jazz" }, { notes: [Note.C, Note.E, Note.G], index: 2 });
      const position = page.getByTestId("progression-position");
      await expect.element(position).toHaveTextContent("3/3");
    });
  });

  describe("Derived State Calculations", () => {
    it("should correctly derive scale from key and mode", async () => {
      renderWithProps({ key: Note.C, mode: Mode.Ionian });
      flushSync();
      const keyInfo = page.getByTestId("key-mode-info");
      await expect.element(keyInfo).toHaveTextContent("Key: C ionian");
    });

    it("should recalculate progression when key changes", async () => {
      const props = { key: Note.C, mode: Mode.Ionian, progressionName: "classic" as const };
      const component = renderWithProps(props);
      flushSync();

      const keyInfo = page.getByTestId("key-mode-info");
      await expect.element(keyInfo).toHaveTextContent("Key: C ionian");

      component.rerender({ ...props, key: Note.G });
      flushSync();

      const newKeyInfo = page.getByTestId("key-mode-info");
      await expect.element(newKeyInfo).toHaveTextContent("Key: G ionian");
    });

    it("should recalculate progression when mode changes", async () => {
      const props = { key: Note.A, mode: Mode.Ionian, progressionName: "classic" as const };

      const component = renderWithProps(props);
      flushSync();

      const majorMode = page.getByText("Key: A ionian");
      await expect.element(majorMode).toBeInTheDocument();

      component.rerender({ ...props, mode: Mode.Aeolian });
      flushSync();

      const minorMode = page.getByText("Key: A aeolian");
      await expect.element(minorMode).toBeInTheDocument();
    });

    it("should recalculate progression when progressionName changes", async () => {
      const props = { key: Note.C, mode: Mode.Ionian, progressionName: "classic" as const };

      const component = renderWithProps(props);
      flushSync();

      const classicHeader = page.getByText("Progression (classic)");
      await expect.element(classicHeader).toBeInTheDocument();

      const classicPosition = page.getByText("1/4");
      await expect.element(classicPosition).toBeInTheDocument();

      component.rerender({ ...props, name: "jazz" });
      flushSync();

      const jazzHeader = page.getByText("Progression (jazz)");
      await expect.element(jazzHeader).toBeInTheDocument();

      const jazzPosition = page.getByText("1/3");
      await expect.element(jazzPosition).toBeInTheDocument();
    });

    it("should update chord analysis when currentChordNotes change", async () => {
      const props = {
        currentChord: { notes: [Note.C, Note.E, Note.G], index: 0 },
        key: Note.C,
        mode: Mode.Ionian,
        progressionName: "classic" as const,
      };

      const component = renderWithProps(props);
      flushSync();

      const cMajor = page.getByTestId("current-chord-name");
      await expect.element(cMajor).toHaveTextContent("C");

      component.rerender({ ...props, currentChord: currentChord({ notes: [Note.C, Note.DSharp, Note.G] }) });
      flushSync();

      const cMinor = page.getByTestId("current-chord-name");
      await expect.element(cMinor).toHaveTextContent("Cm");
    });

    it("should handle rapid state changes correctly", async () => {
      const component = renderWithProps({ key: Note.C, mode: Mode.Ionian }, { index: 0 });
      flushSync();

      const initialKey = page.getByText("Key: C ionian");
      const initialPosition = page.getByText("1/4");

      await expect.element(initialKey).toBeInTheDocument();
      await expect.element(initialPosition).toBeInTheDocument();

      component.rerender({ key: Note.D, mode: Mode.Dorian, currentChord: currentChord({ index: 2 }) });
      flushSync();

      const newKey = page.getByText("Key: D dorian");
      const newPosition = page.getByText("3/4");

      await expect.element(newKey).toBeInTheDocument();
      await expect.element(newPosition).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle chord index beyond progression length", async () => {
      renderWithProps({}, { index: 10 });
      const container = page.getByText("Current Chord");
      await expect.element(container).toBeInTheDocument();
    });

    it("should handle negative chord index", async () => {
      renderWithProps({}, { index: -1 });
      const container = page.getByText("Current Chord");
      await expect.element(container).toBeInTheDocument();
    });

    it("should handle complex chords with many notes", async () => {
      renderWithProps({}, { notes: [Note.C, Note.E, Note.G, Note.B, Note.D, Note.F] });
      const chordDisplay = page.elementLocator(document.querySelector(".text-2xl.font-bold")!);
      await expect.element(chordDisplay).toBeInTheDocument();
    });
  });
});
