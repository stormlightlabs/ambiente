/** Browser audio scheduling and semantic Tone.js sound presets. */
export { LookAheadScheduler } from './scheduler';
export { soundControls, ToneAudioBackend, type SoundControls } from './sounds';
export {
	SOUND_FAMILIES,
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

/** Coordinates browser surfaces so only one scheduler or direct instrument owns audio. */
export class BrowserPlaybackCoordinator {
	private active: LookAheadScheduler | undefined;

	/** Creates a scheduler and transfers browser playback ownership to it. */
	create(source: AudioEventSource, options?: SchedulerOptions): LookAheadScheduler {
		const scheduler = new LookAheadScheduler(source, new ToneAudioBackend(), options);
		this.active?.stop();
		this.active = scheduler;
		scheduler.coordinate(
			() => {
				if (this.active !== scheduler) this.active?.stop();
				this.active = scheduler;
			},
			() => {
				if (this.active === scheduler) this.active = undefined;
			}
		);
		return scheduler;
	}
}

const browserPlayback = new BrowserPlaybackCoordinator();

/** Creates one production scheduler participating in unified browser playback. */
export function createBrowserAudio(source: AudioEventSource, options?: SchedulerOptions): LookAheadScheduler {
	return browserPlayback.create(source, options);
}
