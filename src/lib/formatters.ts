import type { InstrumentType } from "./types/instruments";
import type { GenerativePattern, Layering } from "./types/presets";

/** Adds a space before capital letters & then capitalize first letter  */
export const formatInstrumentName = (instrument: InstrumentType): string =>
  instrument.replaceAll(/([A-Z])/g, " $1").replace(/^./, string_ => string_.toUpperCase()).trim();

export const formatPatternOrLayering = (value: GenerativePattern | Layering): string =>
  value.split(/[-_\s]/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");

export const formatTheme = (theme: string): string => theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase();

export const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);
  if (diff < 60) {
    return `${diff}s ago`;
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  }

  return `${Math.floor(diff / 3600)}h ago`;
};

export const formatEventCount = (count: number): string => count === 1 ? "1 Event" : `${count} Events`;

export function formatDuration(start: number, end: number = Date.now()): string {
  const sec = Math.floor((end - start) / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }

  const min = Math.floor(sec / 60);
  const remSeconds = sec % 60;
  if (min < 60) {
    return `${min}m ${remSeconds}s`;
  }

  const hours = Math.floor(min / 60);
  const remMinutes = min % 60;
  return `${hours}h ${remMinutes}m`;
}
