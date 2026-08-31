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
	type ApplicationMacro,
	type ApplicationMaterial,
	type ApplicationParameterValue,
	type ApplicationPurposePreset,
	type ApplicationPhraseNote,
	type ApplicationTimePoint,
	type ApplicationVoice,
	type DocumentInspection,
	type DocumentOperation,
	type EventQuery,
	type SerializedDocument,
	type StudyName
} from '@ambiente/wasm';
