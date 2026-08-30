/**
 * Browser command/query types and the production WebAssembly implementation.
 *
 * The application keeps this module as its stable import point while the
 * workspace package owns the generated binding wrapper.
 */
export {
	WasmApplication,
	type AmbienteApplication,
	type ApplicationDiagnostic,
	type ApplicationEvent,
	type ApplicationEventKind,
	type ApplicationEventTarget,
	type ApplicationTimePoint,
	type DocumentInspection,
	type DocumentOperation,
	type EventQuery,
	type SerializedDocument
} from '@ambiente/wasm';
