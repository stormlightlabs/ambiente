import { For } from 'solid-js';

const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_PITCH_CLASSES = [1, 3, 6, 8, 10];

/** Input and display state for the responsive Studio piano. */
export type PianoKeyboardProps = Readonly<{
	activePitches: ReadonlySet<number>;
	baseOctave: number;
	disabled?: boolean;
	onNoteOff: (token: string) => void;
	onNoteOn: (token: string, pitch: number) => void;
}>;

/** A two-octave piano that supports independent pointer and touch contacts. */
export function PianoKeyboard(props: PianoKeyboardProps) {
	const whiteKeys = () =>
		Array.from({ length: 2 }, (_, octave) =>
			WHITE_PITCH_CLASSES.map((pitchClass) => midiPitch(props.baseOctave + octave, pitchClass))
		).flat();
	const blackKeys = () =>
		Array.from({ length: 2 }, (_, octave) =>
			BLACK_PITCH_CLASSES.map((pitchClass) => ({
				left: blackKeyLeft(octave, pitchClass),
				pitch: midiPitch(props.baseOctave + octave, pitchClass)
			}))
		).flat();

	function begin(event: PointerEvent, pitch: number) {
		if (props.disabled) return;
		const button = event.currentTarget as HTMLButtonElement;
		button.setPointerCapture(event.pointerId);
		props.onNoteOn(`pointer:${event.pointerId}`, pitch);
	}

	function end(event: PointerEvent) {
		props.onNoteOff(`pointer:${event.pointerId}`);
	}

	return (
		<div class="piano" aria-label={`Piano keyboard, octaves ${props.baseOctave} and ${props.baseOctave + 1}`}>
			<div class="piano__white-keys">
				<For each={whiteKeys()}>
					{(pitch) => (
						<button
							type="button"
							classList={{ 'piano-key': true, 'piano-key--white': true, 'is-active': props.activePitches.has(pitch) }}
							disabled={props.disabled}
							aria-label={pitchName(pitch)}
							onPointerDown={(event) => begin(event, pitch)}
							onPointerUp={end}
							onPointerCancel={end}
							onLostPointerCapture={end}>
							<span>{pitch % 12 === 0 ? pitchName(pitch) : ''}</span>
						</button>
					)}
				</For>
			</div>
			<For each={blackKeys()}>
				{(key) => (
					<button
						type="button"
						classList={{ 'piano-key': true, 'piano-key--black': true, 'is-active': props.activePitches.has(key.pitch) }}
						style={`--key-left: ${key.left}%`}
						disabled={props.disabled}
						aria-label={pitchName(key.pitch)}
						onPointerDown={(event) => begin(event, key.pitch)}
						onPointerUp={end}
						onPointerCancel={end}
						onLostPointerCapture={end}
					/>
				)}
			</For>
		</div>
	);
}

/** Returns a conventional sharp pitch name for a MIDI note number. */
export function pitchName(pitch: number): string {
	const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
	return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

function midiPitch(octave: number, pitchClass: number): number {
	return (octave + 1) * 12 + pitchClass;
}

function blackKeyLeft(octave: number, pitchClass: number): number {
	const whiteIndexByPitchClass: Record<number, number> = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };
	const boundary = octave * 7 + (whiteIndexByPitchClass[pitchClass] ?? 0);
	return (boundary / 14) * 100;
}
