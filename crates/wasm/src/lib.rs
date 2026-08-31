//! WebAssembly command and query boundary for Ambiente.

use std::collections::BTreeMap;

use ambiente_core::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// A browser-facing document runtime that keeps canonical state in Rust.
#[wasm_bindgen]
pub struct AmbienteWasm {
    document: Document,
}

#[wasm_bindgen]
impl AmbienteWasm {
    /// Creates an empty canonical document with fresh browser-safe identities.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error if the default tempo or serialization fails.
    #[wasm_bindgen(js_name = newDocument)]
    pub fn new_document(title: &str) -> Result<String, JsError> {
        let tempo = Tempo::new(120, 1).map_err(|error| js_error(&error))?;
        let document = Document::new(
            DocumentId::new(),
            Metadata::new().with_title(title),
            Seed::default(),
            Piece::new(
                PieceId::new(),
                Transport::new(
                    tempo,
                    Some(Meter::new(4, 4).map_err(|error| js_error(&error))?),
                ),
            ),
        );
        document.to_json().map_err(|error| js_error(&error))
    }

    /// Serializes one bundled first-party study by its lowercase name.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when `name` is not `phase`, `drone`, or `pattern`,
    /// or when the fixed study data cannot be constructed or serialized.
    #[wasm_bindgen(js_name = bundledStudy)]
    pub fn bundled_study(name: &str) -> Result<String, JsError> {
        let document = match name {
            "phase" => phase_study(),
            "drone" => drone_study(),
            "pattern" => pattern_study(),
            _ => return Err(JsError::new("unknown bundled study")),
        }
        .map_err(|error| js_error(&error))?;
        document.to_json().map_err(|error| js_error(&error))
    }

    /// Loads the initial canonical document.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the document cannot be loaded.
    #[wasm_bindgen(constructor)]
    pub fn new(document: &str) -> Result<Self, JsError> {
        Document::from_json(document)
            .map(|document| Self { document })
            .map_err(|error| js_error(&error))
    }

    /// Replaces the active document and returns JSON-encoded diagnostics.
    ///
    /// Invalid input leaves the active document unchanged.
    pub fn load(&mut self, document: &str) -> String {
        match Document::from_json(document) {
            Ok(document) => {
                self.document = document;
                empty_json_array()
            }
            Err(error) => diagnostics_json([BoundaryDiagnostic::error(
                "document.load",
                error.to_string(),
            )]),
        }
    }

    /// Serializes the active document as canonical JSON.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error if canonical serialization fails.
    pub fn serialize(&self) -> Result<String, JsError> {
        self.document.to_json().map_err(|error| js_error(&error))
    }

    /// Applies one JSON-encoded canonical operation atomically.
    pub fn apply(&mut self, operation: &str) -> String {
        let operation = match serde_json::from_str(operation) {
            Ok(operation) => operation,
            Err(error) => {
                return diagnostics_json([BoundaryDiagnostic::error(
                    "operation.parse",
                    error.to_string(),
                )]);
            }
        };
        match self.document.apply(operation) {
            Ok(()) => empty_json_array(),
            Err(OperationError::Validation(diagnostics)) => diagnostics_json(diagnostics),
            Err(error) => diagnostics_json([BoundaryDiagnostic::error(
                "operation.invalid",
                error.to_string(),
            )]),
        }
    }

    /// Returns all current validation diagnostics as JSON.
    #[must_use]
    pub fn validate(&self) -> String {
        diagnostics_json(self.document.validate())
    }

    /// Queries normalized events for one JSON-encoded exact time span.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error for an invalid query or event-generation failure.
    pub fn query_events(&self, query: &str) -> Result<String, JsError> {
        query_events_json(&self.document, query).map_err(|error| js_error(&error))
    }

    /// Returns a small JSON projection of useful document state.
    #[must_use]
    pub fn inspect(&self) -> String {
        let piece = self.document.piece();
        let materials = piece.materials().values().collect();
        let voices = piece
            .voices()
            .values()
            .map(|voice| AudioVoiceInspection {
                enabled: voice.settings().enabled(),
                id: voice.id().to_string(),
                material_id: voice
                    .settings()
                    .pattern()
                    .and_then(sole_material)
                    .map(|id| id.to_string()),
                name: voice.settings().name(),
                parameters: voice.settings().parameters(),
                pattern: voice.settings().pattern(),
                sound: voice.settings().sound().as_str(),
            })
            .collect();
        json(&DocumentInspection {
            document_id: self.document.id().to_string(),
            material_count: piece.materials().len(),
            materials,
            seed: self.document.seed().to_string(),
            tempo: piece.transport().tempo().to_string(),
            title: self
                .document
                .metadata()
                .title()
                .unwrap_or("Untitled system"),
            voice_count: piece.voices().len(),
            voices,
        })
    }
}

fn sole_material(pattern: &Pattern) -> Option<MaterialId> {
    match pattern {
        Pattern::Material { material_id } => Some(*material_id),
        Pattern::Sequence { patterns }
        | Pattern::Stack { patterns }
        | Pattern::Choose { patterns, .. } => sole_material_in(patterns.iter()),
        Pattern::WeightedChoose { patterns, .. } => {
            sole_material_in(patterns.iter().map(WeightedPattern::pattern))
        }
        Pattern::Repeat { pattern, .. }
        | Pattern::Transform { pattern, .. }
        | Pattern::Omit { pattern, .. }
        | Pattern::Sometimes { pattern, .. } => sole_material(pattern),
    }
}

fn sole_material_in<'a>(patterns: impl Iterator<Item = &'a Pattern>) -> Option<MaterialId> {
    let mut materials = patterns.map(sole_material);
    let first = materials.next()??;
    materials
        .all(|material| material == Some(first))
        .then_some(first)
}

/// Runs an event query and returns the stable browser event representation.
///
/// This function is public so native conformance tests can exercise the exact
/// normalization code used by WebAssembly.
///
/// # Errors
///
/// Returns an error when the query JSON or event generation is invalid.
pub fn query_events_json(document: &Document, query: &str) -> Result<String, String> {
    let query: EventQuery = serde_json::from_str(query).map_err(|error| error.to_string())?;
    let span = match query.clock {
        QueryClock::Metric => TimeSpan::metric(
            query
                .start
                .parse()
                .map_err(|error: TimeError| error.to_string())?,
            query
                .end
                .parse()
                .map_err(|error: TimeError| error.to_string())?,
        ),
        QueryClock::Absolute => TimeSpan::absolute(
            query
                .start
                .parse()
                .map_err(|error: TimeError| error.to_string())?,
            query
                .end
                .parse()
                .map_err(|error: TimeError| error.to_string())?,
        ),
    }
    .map_err(|error| error.to_string())?;
    let events = document
        .query_events(span)
        .map_err(|error| error.to_string())?;
    serde_json::to_string(&events).map_err(|error| error.to_string())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EventQuery {
    clock: QueryClock,
    start: String,
    end: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum QueryClock {
    Metric,
    Absolute,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentInspection<'a> {
    document_id: String,
    material_count: usize,
    materials: Vec<&'a Material>,
    seed: String,
    tempo: String,
    title: &'a str,
    voice_count: usize,
    voices: Vec<AudioVoiceInspection<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AudioVoiceInspection<'a> {
    enabled: bool,
    id: String,
    material_id: Option<String>,
    name: &'a str,
    parameters: &'a BTreeMap<String, ParameterValue>,
    pattern: Option<&'a Pattern>,
    sound: &'a str,
}

#[derive(Serialize)]
struct BoundaryDiagnostic {
    code: &'static str,
    severity: &'static str,
    message: String,
}

impl BoundaryDiagnostic {
    fn error(code: &'static str, message: String) -> Self {
        Self {
            code,
            severity: "error",
            message,
        }
    }
}

fn diagnostics_json(diagnostics: impl Serialize) -> String {
    json(&diagnostics)
}

fn empty_json_array() -> String {
    "[]".to_owned()
}

fn json(value: &impl Serialize) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| {
        r#"[{"code":"boundary.serialize","severity":"error","message":"could not serialize boundary response"}]"#.to_owned()
    })
}

fn js_error(error: &impl ToString) -> JsError {
    JsError::new(&error.to_string())
}
