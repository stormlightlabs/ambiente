import * as Tone from "tone";
import { AmbientMixer } from "./audio/mixer";
import { Note, NoteUtilities } from "./theory";

export const initializeAudio = async (): Promise<void> => {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
};

export const noteToFrequency = (note: Note, octave: number = 4): number =>
  Tone.Frequency(`${NoteUtilities.toString(note)}${octave}`).toFrequency();

export const noteToToneString = (note: Note, octave: number = 4): string => `${NoteUtilities.toString(note)}${octave}`;

export const chordToToneStrings = (chord: Note[], octave: number = 4): string[] =>
  chord.map(note => noteToToneString(note, octave));

export const ambientMixer = new AmbientMixer();

export { createEffectsChain, ParameterAutomation } from "./audio/effects";
export { AmbientMixer } from "./audio/mixer";
export { createSynth, DEFAULT_SYNTH_PARAMS } from "./audio/synth-factory";
