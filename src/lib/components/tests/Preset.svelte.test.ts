import Preset from "$components/Preset.svelte";
import { Mode, Note } from "$lib/theory";
import { InstrumentType } from "$lib/types/instruments";
import type { Preset as PresetType } from "$lib/types/presets";
import { page, userEvent } from "@vitest/browser/context";
import { type ComponentProps } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

const createMockPreset = (overrides: Partial<PresetType> = {}): PresetType => ({
  id: "test-preset",
  name: "Test Preset",
  description: "A test preset for testing purposes",
  theme: "Test",
  config: {
    key: Note.C,
    mode: Mode.Ionian,
    tempo: 80,
    volume: -6,
    instruments: new Set([InstrumentType.Pad, InstrumentType.Atmosphere]),
  },
  texture: {
    name: "Test Texture",
    tempo: 80,
    scale: ["C", "D", "E"],
    voices: [{ type: "synth", count: 1 }],
    processing: { reverb: { wet: 0.3, decay: 2, preDelay: 0.1 } },
    structure: { density: 0.5, randomness: 0.3, layering: "medium", generativePattern: "static-drone" },
    mix: { width: 0.8, tapeSaturation: 0.2, volume: -6 },
    instruments: {
      ambientPad: { volume: -6, muted: false, enabled: true, filterFreq: 1000, resonance: 0.5 },
      melodic: { volume: -8, muted: false, enabled: false, octave: 4 },
      granular: { volume: -12, muted: false, enabled: false, density: 0.5, grainSize: 0.5, pitch: 0, spread: 0.5 },
      harmonicDrone: {
        volume: -12,
        muted: false,
        enabled: false,
        changeInterval: 8,
        voiceLeading: 0.5,
        voiceCount: 3,
        spread: 1200,
      },
      rhythmicPulse: {
        volume: -12,
        muted: false,
        enabled: false,
        baseTempo: 80,
        accentProb: 0.3,
        layerCount: 2,
        tempoVar: 0.1,
        syncopation: 0.2,
      },
    },
  },
  ...overrides,
});

describe("Preset", () => {
  const onLoadPreset = vi.fn();

  const renderWithProps = (overrides: Partial<ComponentProps<typeof Preset>> = {}) => {
    const defaultProps = { preset: createMockPreset(), isSelected: false, loadPreset: onLoadPreset };
    return render(Preset, { ...defaultProps, ...overrides });
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render the preset with basic structure", async () => {
      renderWithProps();

      const presetCard = page.getByRole("button");
      await expect.element(presetCard).toBeInTheDocument();
    });

    it("should display preset name", async () => {
      const preset = createMockPreset({ name: "My Awesome Preset" });
      renderWithProps({ preset });

      const name = page.getByText("My Awesome Preset");
      await expect.element(name).toBeInTheDocument();
    });

    it("should display preset description", async () => {
      const preset = createMockPreset({ description: "This is a unique description" });
      renderWithProps({ preset });

      const description = page.getByText("This is a unique description");
      await expect.element(description).toBeInTheDocument();
    });

    it("should display preset theme", async () => {
      const preset = createMockPreset({ theme: "Ambient" });
      renderWithProps({ preset });

      const theme = page.getByText("Ambient");
      await expect.element(theme).toBeInTheDocument();
    });
  });

  describe("Configuration Display", () => {
    it("should display tempo information", async () => {
      const preset = createMockPreset({ config: { tempo: 120 } });
      renderWithProps({ preset });

      const tempo = page.getByText("Tempo: 120 BPM");
      await expect.element(tempo).toBeInTheDocument();
    });

    it("should display 'Variable' when tempo is not set", async () => {
      const preset = createMockPreset({ config: {} });
      renderWithProps({ preset });

      const tempo = page.getByText("Tempo: Variable BPM");
      await expect.element(tempo).toBeInTheDocument();
    });

    it("should display key and mode information", async () => {
      const preset = createMockPreset({ config: { key: Note.D, mode: Mode.Dorian } });
      renderWithProps({ preset });

      const keyMode = page.getByText("Key: D dorian");
      await expect.element(keyMode).toBeInTheDocument();
    });

    it("should display 'Variable' when key is not set", async () => {
      const preset = createMockPreset({ config: {} });
      renderWithProps({ preset });

      const keyMode = page.getByText("Key: Variable");
      await expect.element(keyMode).toBeInTheDocument();
    });

    it("should display instrument count", async () => {
      const preset = createMockPreset({
        config: { instruments: new Set([InstrumentType.Pad, InstrumentType.Bass, InstrumentType.Lead]) },
      });
      renderWithProps({ preset });

      const instruments = page.getByText("Instruments: 3");
      await expect.element(instruments).toBeInTheDocument();
    });

    it("should display 0 instruments when not set", async () => {
      const preset = createMockPreset({ config: {} });
      renderWithProps({ preset });

      const instruments = page.getByText("Instruments: 0");
      await expect.element(instruments).toBeInTheDocument();
    });
  });

  describe("Texture Information", () => {
    it("should display texture layering when texture exists", async () => {
      const preset = createMockPreset({
        texture: {
          name: "Test Texture",
          tempo: 80,
          scale: ["C", "D", "E"],
          voices: [{ type: "synth", count: 1 }],
          processing: { reverb: { wet: 0.3, decay: 2, preDelay: 0.1 } },
          structure: { density: 0.5, randomness: 0.3, layering: "minimal", generativePattern: "static-drone" },
          mix: { width: 0.8, tapeSaturation: 0.2, volume: -6 },
          instruments: {
            ambientPad: { volume: -6, muted: false, enabled: true, filterFreq: 1000, resonance: 0.5 },
            melodic: { volume: -8, muted: false, enabled: false, octave: 4 },
            granular: {
              volume: -12,
              muted: false,
              enabled: false,
              density: 0.5,
              grainSize: 0.5,
              pitch: 0,
              spread: 0.5,
            },
            harmonicDrone: {
              volume: -12,
              muted: false,
              enabled: false,
              changeInterval: 8,
              voiceLeading: 0.5,
              voiceCount: 3,
              spread: 1200,
            },
            rhythmicPulse: {
              volume: -12,
              muted: false,
              enabled: false,
              baseTempo: 80,
              accentProb: 0.3,
              layerCount: 2,
              tempoVar: 0.1,
              syncopation: 0.2,
            },
          },
        },
      });
      renderWithProps({ preset });

      const texture = page.getByText("Texture: Minimal layering");
      await expect.element(texture).toBeInTheDocument();
    });
  });

  describe("Selection State", () => {
    it("should apply selected styling when isSelected is true", async () => {
      renderWithProps({ isSelected: true });

      const presetCard = page.getByRole("button");
      await expect.element(presetCard).toHaveClass("border-primary-600");
      await expect.element(presetCard).toHaveClass("bg-primary-50");
    });

    it("should apply default styling when isSelected is false", async () => {
      renderWithProps({ isSelected: false });

      const presetCard = page.getByRole("button");
      await expect.element(presetCard).toHaveClass("border-surface-200");
    });
  });

  describe("User Interactions", () => {
    it("should call loadPreset when preset card is clicked", async () => {
      const preset = createMockPreset();
      renderWithProps({ preset });

      const presetCard = page.getByRole("button");
      await userEvent.click(presetCard);

      expect(onLoadPreset).toHaveBeenCalledOnce();
      expect(onLoadPreset).toHaveBeenCalledWith(preset);
    });

    it("should call loadPreset when Enter key is pressed", async () => {
      const preset = createMockPreset();
      renderWithProps({ preset });

      const presetCard = page.getByRole("button");
      vi.waitFor(() => {
        presetCard.element().dispatchEvent(new FocusEvent("focus_event"));
      });

      await userEvent.click(presetCard);
      await userEvent.keyboard("{Enter}");

      expect(onLoadPreset).toHaveBeenCalledTimes(2);
    });

    it("should not call loadPreset when other keys are pressed", async () => {
      renderWithProps();

      const presetCard = page.getByRole("button");
      await userEvent.keyboard("{Space}");

      expect(onLoadPreset).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have proper button role", async () => {
      renderWithProps();

      const presetCard = page.getByRole("button");
      await expect.element(presetCard).toBeInTheDocument();
    });

    it("should be focusable", async () => {
      renderWithProps();
      const presetCard = page.getByRole("button");
      await expect.element(presetCard).toHaveAttribute("tabindex", "0");
    });

    it("should support keyboard navigation", async () => {
      renderWithProps();
      const presetCard = page.getByRole("button");
      await expect.element(presetCard).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle preset with minimal configuration", async () => {
      const preset = createMockPreset({ config: {} });
      renderWithProps({ preset });

      const presetCard = page.getByRole("button");
      await expect.element(presetCard).toBeInTheDocument();

      const tempo = page.getByText("Tempo: Variable BPM");
      const key = page.getByText("Key: Variable");
      const instruments = page.getByText("Instruments: 0");

      await expect.element(tempo).toBeInTheDocument();
      await expect.element(key).toBeInTheDocument();
      await expect.element(instruments).toBeInTheDocument();
    });

    it("should handle preset with complex texture", async () => {
      const preset = createMockPreset({
        texture: {
          name: "Complex Texture",
          tempo: 140,
          scale: ["C", "D", "E", "F", "G", "A", "B"],
          voices: [{ type: "synth", count: 3 }],
          processing: { reverb: { wet: 0.8, decay: 5, preDelay: 0.3 } },
          structure: { density: 0.8, randomness: 0.6, layering: "dense", generativePattern: "markov" },
          mix: { width: 0.9, tapeSaturation: 0.4, volume: -3 },
          instruments: {
            ambientPad: { volume: -6, muted: false, enabled: true, filterFreq: 1000, resonance: 0.5 },
            melodic: { volume: -8, muted: false, enabled: false, octave: 4 },
            granular: {
              volume: -12,
              muted: false,
              enabled: false,
              density: 0.5,
              grainSize: 0.5,
              pitch: 0,
              spread: 0.5,
            },
            harmonicDrone: {
              volume: -12,
              muted: false,
              enabled: false,
              changeInterval: 8,
              voiceLeading: 0.5,
              voiceCount: 3,
              spread: 1200,
            },
            rhythmicPulse: {
              volume: -12,
              muted: false,
              enabled: false,
              baseTempo: 140,
              accentProb: 0.3,
              layerCount: 2,
              tempoVar: 0.1,
              syncopation: 0.2,
            },
          },
        },
      });
      renderWithProps({ preset });

      const texture = page.getByText("Texture: Dense layering");
      await expect.element(texture).toBeInTheDocument();
    });

    it("should handle long preset names and descriptions", async () => {
      const preset = createMockPreset({
        name: "This is a very long preset name that might wrap to multiple lines",
        description:
          "This is an extremely long description that contains multiple sentences and should test how well the component handles lengthy text content that might affect the layout.",
      });
      renderWithProps({ preset });

      const name = page.getByText("This is a very long preset name that might wrap to multiple lines");
      const description = page.getByText(/This is an extremely long description/);

      await expect.element(name).toBeInTheDocument();
      await expect.element(description).toBeInTheDocument();
    });
  });
});
