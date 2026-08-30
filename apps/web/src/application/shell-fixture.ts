import type {
	AmbienteApplication,
	ApplicationDiagnostic,
	ApplicationEvent,
	DocumentInspection,
	DocumentOperation,
	EventQuery,
	SerializedDocument
} from './facade';

const fixtureInspection: DocumentInspection = {
	documentId: 'fixture-document',
	materialCount: 1,
	materials: [],
	seed: '000000000000002a',
	tempo: '120/1',
	title: 'Untitled system',
	voiceCount: 1,
	voices: [
		{
			enabled: true,
			id: 'fixture-voice',
			materialId: null,
			name: 'Piano',
			parameters: {},
			pattern: null,
			sound: 'felt-piano'
		}
	]
};

const fixtureDocument = JSON.stringify({ format: 'ambiente', fixture: true, schema_version: 2 });

/**
 * Temporary shell adapter that proves the facade without implementing musical
 * behavior outside Rust.
 */
export class ShellFixtureApplication implements AmbienteApplication {
	private document: SerializedDocument = fixtureDocument;

	/** Stores input verbatim; canonical parsing remains a WASM responsibility. */
	load(document: SerializedDocument): readonly ApplicationDiagnostic[] {
		this.document = document;
		return [];
	}

	/** Returns the exact fixture document currently held by the adapter. */
	serialize(): SerializedDocument {
		return this.document;
	}

	/** Refuses edits because this adapter cannot interpret canonical operations. */
	apply(operation: DocumentOperation): readonly ApplicationDiagnostic[] {
		void operation;
		return [
			{
				code: 'shell.fixture.read_only',
				help: 'Use the WASM application adapter when document editing is available.',
				message: 'The Studio shell fixture is read-only.',
				severity: 'warning'
			}
		];
	}

	/** Returns no diagnostics because the fixture does not validate documents. */
	validate(): readonly ApplicationDiagnostic[] {
		return [];
	}

	/** Returns no events because event generation belongs to the Rust core. */
	queryEvents(query: EventQuery): readonly ApplicationEvent[] {
		void query;
		return [];
	}

	/** Returns a fixed projection used only to lay out the first Studio shell. */
	inspect(): DocumentInspection {
		return fixtureInspection;
	}
}

/** Creates the temporary read-only adapter used before ambiente-wasm exists. */
export function createShellFixtureApplication(): AmbienteApplication {
	return new ShellFixtureApplication();
}
