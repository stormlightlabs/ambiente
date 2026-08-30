/** Browser audio scheduling and semantic Tone.js sound presets. */
export { LookAheadScheduler } from './scheduler';
export { soundControls, ToneAudioBackend, type SoundControls } from './sounds';
export {
	SOUND_IDS,
	eventIdentity,
	isSoundId,
	type AudioBackend,
	type AudioDocument,
	type AudioEventSource,
	type AudioParameterValue,
	type AudioVoice,
	type ScheduledNote,
	type SchedulerOptions,
	type SchedulerTimer,
	type SoundId,
	type TransportListener,
	type TransportState
} from './types';

import type { AudioEventSource, SchedulerOptions } from './types';
import { LookAheadScheduler } from './scheduler';
import { ToneAudioBackend } from './sounds';

/** Creates the production look-ahead scheduler over Tone.js and Web Audio. */
export function createBrowserAudio(source: AudioEventSource, options?: SchedulerOptions): LookAheadScheduler {
	return new LookAheadScheduler(source, new ToneAudioBackend(), options);
}
