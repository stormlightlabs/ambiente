/* eslint-disable no-console */
const ENABLED = import.meta.env.DEV
  || (globalThis.window === undefined
    ? false
    : localStorage.getItem("DEBUG_AUDIO_LIFECYCLE") === "true" || import.meta.env.DEBUG_AUDIO_LIFECYCLE === "true");

export const logger = {
  isEnabled: () => ENABLED,
  enable: () => (globalThis.window === undefined) ? void 0 : localStorage.setItem("DEBUG_AUDIO_LIFECYCLE", "true"),
  disable: () => (globalThis.window === undefined) ? void 0 : localStorage.removeItem("DEBUG_AUDIO_LIFECYCLE"),
  error: (prefix: string, message: string, ...args: any[]) => console.error(`${prefix} ${message}`, ...args),
  debug: (prefix: string, message: string, ...args: any[]) =>
    ENABLED ? console.log(`${prefix} ${message}`, ...args) : void 0,
};
