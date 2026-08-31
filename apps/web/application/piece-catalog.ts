import type { StudyName } from './facade';
import type { PlayablePiece } from './site-player';

/** First-party pieces currently available through the persistent site player. */
export const FIRST_PARTY_PIECES: readonly [PlayablePiece, ...PlayablePiece[]] = [
	studyPiece('phase', 'Phase Study'),
	studyPiece('drone', 'Drone Study'),
	studyPiece('pattern', 'Pattern Study')
];

/** Returns the player entry for one canonical Study. */
export function playableStudy(study: StudyName): PlayablePiece {
	const piece = FIRST_PARTY_PIECES.find((candidate) => candidate.id === study);
	if (!piece) throw new Error(`The ${study} Study is missing from the first-party piece catalog.`);
	return piece;
}

function studyPiece(study: StudyName, title: string): PlayablePiece {
	return {
		downloadName: `${study}.ambiente.json`,
		href: `/docs/three-studies#${study}`,
		id: study,
		load: async () => {
			const { WasmApplication } = await import('./facade');
			return WasmApplication.createStudy(study);
		},
		title
	};
}
