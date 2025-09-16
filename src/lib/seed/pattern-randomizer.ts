import type { Note } from "$lib/theory";
import type { InstrumentPattern } from "$lib/types/audio";
import type { InstrumentType } from "$lib/types/instruments";

type GenerativePatternType = "random-walk" | "euclidean" | "static-drone" | "markov";

export class PatternRandomizer {
  private static seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10_000;
    return x - Math.floor(x);
  }

  static randomizeRhythm(pattern: InstrumentPattern, variability: number, seed = Math.random()): InstrumentPattern {
    if (variability === 0) return pattern;

    const randomizedSteps = pattern.steps.map((step, index) => {
      const stepSeed = seed + index * 0.1;
      const random = this.seededRandom(stepSeed);

      if (random < variability * 0.3) {
        return { ...step, enabled: !step.enabled };
      }

      if (random < variability * 0.5) {
        const velocityVariation = (random - 0.5) * 0.2 * variability;
        return { ...step, velocity: Math.max(0.1, Math.min(1, step.velocity + velocityVariation)) };
      }

      return step;
    });

    return { ...pattern, steps: randomizedSteps };
  }

  static randomizeMelody(
    pattern: InstrumentPattern,
    scale: Note[],
    variability: number,
    seed = Math.random(),
  ): InstrumentPattern {
    if (variability === 0 || scale.length === 0) return pattern;

    const randomizedSteps = pattern.steps.map((step, index) => {
      const stepSeed = seed + index * 0.2;
      const random = this.seededRandom(stepSeed);

      if (random < variability * 0.4 && step.enabled) {
        const currentIndex = scale.indexOf(step.note);
        if (currentIndex !== -1) {
          const maxJump = Math.ceil(scale.length * 0.3);
          const direction = random < 0.5 ? -1 : 1;
          const jump = Math.floor(random * maxJump) + 1;
          const newIndex = (currentIndex + direction * jump + scale.length) % scale.length;

          return { ...step, note: scale[newIndex] };
        }
      }

      return step;
    });

    return { ...pattern, steps: randomizedSteps };
  }

  static randomizeProgression(
    progression: Note[][],
    scale: Note[],
    variability: number,
    constraintStrength = 0.7,
    seed = Math.random(),
  ): Note[][] {
    if (variability === 0 || scale.length === 0) return progression;

    return progression.map((chord, index) => {
      const chordSeed = seed + index * 0.3;
      const random = this.seededRandom(chordSeed);

      if (random < variability * 0.3) {
        const rootIndex = scale.indexOf(chord[0]);
        if (rootIndex !== -1) {
          const maxJump = Math.max(1, Math.floor((1 - constraintStrength) * scale.length * 0.5));
          const direction = random < 0.5 ? -1 : 1;
          const jump = Math.floor(random * maxJump) + 1;
          const newRootIndex = (rootIndex + direction * jump + scale.length) % scale.length;

          return chord.map((_, chordIndex) => {
            const noteOffset = chordIndex * 2;
            return scale[(newRootIndex + noteOffset) % scale.length];
          });
        }
      }

      return chord;
    });
  }

  static evolvePattern(pattern: InstrumentPattern, evolution: number, seed = Math.random()): InstrumentPattern {
    if (evolution === 0) return pattern;

    const mutatedSteps = pattern.steps.map((step, index) => {
      const mutationSeed = seed + index * 0.4;
      const random = this.seededRandom(mutationSeed);

      if (random < evolution * 0.25) {
        const durations = ["8n", "4n", "2n", "1m"];
        const currentIndex = durations.indexOf(step.duration);
        const newIndex = Math.max(0, Math.min(durations.length - 1, currentIndex + (random < 0.5 ? -1 : 1)));

        return { ...step, duration: durations[newIndex] };
      }

      if (random < evolution * 0.15) {
        return { ...step, enabled: random < 0.7 };
      }

      return step;
    });

    return { ...pattern, steps: mutatedSteps };
  }

  static generatePatternByType(
    patternType: GenerativePatternType,
    instrumentType: InstrumentType,
    length: number,
    scale: Note[],
    density: number,
    randomness: number,
    seed = Math.random(),
  ): InstrumentPattern {
    switch (patternType) {
      case "random-walk": {
        return this.generateRandomWalkPattern(instrumentType, length, scale, density, randomness, seed);
      }
      case "euclidean": {
        return this.generateEuclideanPattern(instrumentType, length, scale, density, randomness, seed);
      }
      case "static-drone": {
        return this.generateStaticDronePattern(instrumentType, length, scale, density, randomness, seed);
      }
      case "markov": {
        return this.generateMarkovPattern(instrumentType, length, scale, density, randomness, seed);
      }
      default: {
        return this.generateRandomWalkPattern(instrumentType, length, scale, density, randomness, seed);
      }
    }
  }

  private static generateRandomWalkPattern(
    instrumentType: any,
    length: number,
    scale: Note[],
    density: number,
    randomness: number,
    seed: number,
  ): InstrumentPattern {
    const steps = [];
    let currentNoteIndex = Math.floor(scale.length / 2); // Start in middle of scale

    for (let index = 0; index < length; index++) {
      const stepSeed = seed + index * 0.1;
      const random = this.seededRandom(stepSeed);
      const enabled = random < density;

      if (enabled && random < randomness * 0.8) {
        // Random walk: small steps up or down
        const direction = random < 0.5 ? -1 : 1;
        const stepSize = Math.floor(random * 3) + 1; // 1-3 semitones
        currentNoteIndex = Math.max(0, Math.min(scale.length - 1, currentNoteIndex + direction * stepSize));
      }

      steps.push({
        note: scale[currentNoteIndex] || scale[0],
        velocity: 0.3 + random * 0.4, // Gentle dynamics
        duration: "4n",
        enabled,
      });
    }

    return { type: instrumentType, steps, length, enabled: true };
  }

  private static generateEuclideanPattern(
    instrumentType: any,
    length: number,
    scale: Note[],
    density: number,
    randomness: number,
    seed: number,
  ): InstrumentPattern {
    const steps = [];
    const onsets = Math.floor(length * density);
    const euclideanRhythm = this.generateEuclideanRhythm(onsets, length);

    for (let index = 0; index < length; index++) {
      const stepSeed = seed + index * 0.15;
      const random = this.seededRandom(stepSeed);
      const enabled = euclideanRhythm[index];

      // Use randomness to vary note selection within scale
      const noteIndex = Math.floor(random * scale.length * (1 + randomness));

      steps.push({
        note: scale[noteIndex % scale.length] || scale[0],
        velocity: 0.5 + random * 0.3,
        duration: enabled ? "8n" : "4n", // Shorter notes for rhythmic patterns
        enabled,
      });
    }

    return { type: instrumentType, steps, length, enabled: true };
  }

  private static generateStaticDronePattern(
    instrumentType: any,
    length: number,
    scale: Note[],
    density: number,
    randomness: number,
    seed: number,
  ): InstrumentPattern {
    const steps = [];
    const baseRandom = this.seededRandom(seed);
    const rootNote = scale[Math.floor(baseRandom * scale.length)] || scale[0];

    for (let index = 0; index < length; index++) {
      const stepSeed = seed + index * 0.05; // Very slow change
      const random = this.seededRandom(stepSeed);

      // Static drone: mostly same note, very occasional changes
      let note = rootNote;
      if (random < randomness * 0.1) {
        // Rare harmonic variations
        const harmonicNotes = [scale[0], scale[2], scale[4]].filter(Boolean); // Root, third, fifth
        note = harmonicNotes[Math.floor(random * harmonicNotes.length)] || rootNote;
      }

      steps.push({
        note,
        velocity: 0.6 + random * 0.2, // Stable dynamics
        duration: "1m", // Long sustained notes
        enabled: random < density * 1.2, // Higher chance of notes being on
      });
    }

    return { type: instrumentType, steps, length, enabled: true };
  }

  private static generateMarkovPattern(
    instrumentType: any,
    length: number,
    scale: Note[],
    density: number,
    randomness: number,
    seed: number,
  ): InstrumentPattern {
    const steps = [];

    // Simple Markov chain: each note has probabilities for next note
    const createTransitionMatrix = () => {
      const matrix: number[][] = [];
      for (let index = 0; index < scale.length; index++) {
        matrix[index] = [];
        for (let index_ = 0; index_ < scale.length; index_++) {
          const distance = Math.abs(index - index_);
          // Prefer staying close (small intervals)
          const probability = distance === 0 ? 0.3 : Math.max(0.05, 0.4 / (distance + 1));
          matrix[index][index_] = probability * (1 + randomness);
        }
        // Normalize probabilities
        const sum = matrix[index].reduce((a, b) => a + b, 0);
        matrix[index] = matrix[index].map(p => p / sum);
      }
      return matrix;
    };

    const transitionMatrix = createTransitionMatrix();
    let currentNoteIndex = 0;

    for (let index = 0; index < length; index++) {
      const stepSeed = seed + index * 0.2;
      const random = this.seededRandom(stepSeed);
      const enabled = random < density;

      if (enabled) {
        // Choose next note based on Markov probabilities
        let cumulative = 0;
        for (let index = 0; index < scale.length; index++) {
          cumulative += transitionMatrix[currentNoteIndex][index];
          if (random < cumulative) {
            currentNoteIndex = index;
            break;
          }
        }
      }

      steps.push({ note: scale[currentNoteIndex] || scale[0], velocity: 0.4 + random * 0.4, duration: "4n", enabled });
    }

    return { type: instrumentType, steps, length, enabled: true };
  }

  private static generateEuclideanRhythm(onsets: number, length: number): boolean[] {
    if (onsets >= length) return Array.from({ length }, () => true);
    if (onsets === 0) return Array.from({ length }, () => false);

    const pattern: boolean[] = Array.from({ length }, () => false);
    const step = length / onsets;

    for (let index_ = 0; index_ < onsets; index_++) {
      const index = Math.floor(index_ * step);
      pattern[index] = true;
    }

    return pattern;
  }
}
