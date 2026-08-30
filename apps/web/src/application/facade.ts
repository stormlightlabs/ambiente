/** A serialized canonical Ambiente document passed across the WASM boundary. */
export type SerializedDocument = string;

/** An opaque operation interpreted by the canonical Rust implementation. */
export type DocumentOperation = Readonly<{ kind: string; payload?: unknown }>;

/** A half-open event query span expressed in one exact canonical clock. */
export type EventQuery = Readonly<{ clock: 'absolute' | 'metric'; end: string; start: string }>;

/** A backend-independent event projection returned to browser consumers. */
export type ApplicationEvent = Readonly<{ end: string; kind: string; start: string; target: string }>;

/** A user-facing diagnostic produced by loading, operations, or validation. */
export type ApplicationDiagnostic = Readonly<{
	code: string;
	help?: string;
	message: string;
	severity: 'error' | 'warning';
}>;

/** A small projection of document state for Studio views. */
export type DocumentInspection = Readonly<{
	documentId: string;
	materialCount: number;
	seed: string;
	title: string;
	voiceCount: number;
}>;

/** The command/query boundary consumed by Studio and implemented by WASM in M5. */
export interface AmbienteApplication {
	/** Replaces the active document with canonical serialized input. */
	load(document: SerializedDocument): readonly ApplicationDiagnostic[];

	/** Serializes the active canonical document. */
	serialize(): SerializedDocument;

	/** Applies one canonical document operation atomically. */
	apply(operation: DocumentOperation): readonly ApplicationDiagnostic[];

	/** Reports all useful independent document diagnostics. */
	validate(): readonly ApplicationDiagnostic[];

	/** Queries normalized events that intersect a half-open time span. */
	queryEvents(query: EventQuery): readonly ApplicationEvent[];

	/** Returns the small document projection needed by the current Studio shell. */
	inspect(): DocumentInspection;
}
