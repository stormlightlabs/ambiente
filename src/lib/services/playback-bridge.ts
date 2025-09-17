import type { AudioEngine } from "$lib/engines/audio-engine";
import { playbackStore } from "$lib/stores/playback-store.svelte";
import type { AudioEvent } from "$lib/types/audio";
import type { Subscription } from "rxjs";
import { take } from "rxjs/operators";

export class PlaybackBridge {
  private audioEngineSubscription?: Subscription;
  private chordSubscription?: Subscription;
  private currentAudioEngine?: AudioEngine;

  connect(audioEngine: AudioEngine): void {
    this.disconnect();
    this.currentAudioEngine = audioEngine;

    this.audioEngineSubscription = audioEngine.getEvents$().subscribe((event: AudioEvent) => {
      this.handleAudioEvent(event);
    });

    this.chordSubscription = audioEngine.getCurrentChord$().subscribe((chord) => {
      if (chord.length > 0) {
        audioEngine.getState$().pipe(take(1)).subscribe(state => {
          playbackStore.updateChord(chord, state.currentChord);
        });
      }
    });

    playbackStore.startTracking();
  }

  disconnect(): void {
    if (this.audioEngineSubscription) {
      this.audioEngineSubscription.unsubscribe();
      this.audioEngineSubscription = undefined;
    }

    if (this.chordSubscription) {
      this.chordSubscription.unsubscribe();
      this.chordSubscription = undefined;
    }

    this.currentAudioEngine = undefined;
    playbackStore.stopTracking();
  }

  setPresetName(presetName: string): void {
    playbackStore.setPreset(presetName);
  }

  private handleAudioEvent(event: AudioEvent): void {
    switch (event.type) {
      case "play": {
        playbackStore.startTracking();
        break;
      }
      case "stop": {
        playbackStore.stopTracking();
        break;
      }
      case "chord-change": {
        if (event.data?.chord && typeof event.data.index === "number") {
          playbackStore.updateChord(event.data.chord, event.data.index);
        }
        break;
      }
      case "instrument-toggle": {
        if (event.data?.instrument && typeof event.data.enabled === "boolean") {
          playbackStore.updateInstrumentActivity(event.data.instrument, event.data.enabled);
        }
        break;
      }
      case "note-played": {
        if (event.data?.instrument && event.data?.notes) {
          playbackStore.updateInstrumentNotes(
            event.data.instrument,
            event.data.notes,
            event.data.velocity,
            event.data.duration,
          );
        }
        break;
      }
      case "instrument-tick": {
        if (event.data?.instrument) {
          playbackStore.instrumentTick(event.data.instrument);
        }
        break;
      }
    }
  }

  dispose(): void {
    this.disconnect();
  }
}

export const playbackBridge = new PlaybackBridge();
