import { logger } from "$lib/debug/audio-logger";
import type { Note } from "$lib/theory";
import type { Observable, Subscription } from "rxjs";
import * as Tone from "tone";
import type { Params } from "./params";

export abstract class BaseInstrument<T extends Params> {
  declare PREFIX: string;
  currentScale: Note[] = [];
  subscriptions: Subscription[] = [];

  declare output: Tone.Gain;

  constructor(initialParams: Partial<T> = {}) {}

  abstract tick(time: number, tickDuration: number): void;
  abstract connect(destination: Tone.ToneAudioNode): void;
  abstract dispose(): void;
  abstract updateParams(newParams: Partial<T>): void;
  abstract getParams(): Observable<T>;

  setScale(scale: Note[]): void {
    this.currentScale = [...scale];
  }

  log(message: string, ...args: any[]) {
    logger.debug(this.PREFIX ?? "", message, ...args);
  }

  error(message: string, error_: unknown, ...args: any[]) {
    logger.error(this.PREFIX ?? "", message, error_, args);
  }
}
