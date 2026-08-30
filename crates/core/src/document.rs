//! Versioned musical documents, validation, and atomic edit operations.

use std::{collections::BTreeMap, fmt, str::FromStr};

use serde::{Deserialize, Deserializer, Serialize, Serializer, de};
use thiserror::Error;
use uuid::{Uuid, Version};

use crate::prelude::*;

/// The current persisted document schema version.
pub const SCHEMA_VERSION: u32 = 1;
const FORMAT: &str = "ambiente";

/// An error produced while parsing or constructing an entity ID.
#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum IdError {
    /// The string was not a UUID.
    #[error("invalid UUID: {0}")]
    InvalidUuid(String),
    /// Ambiente entity IDs must use UUID version 4 and must not be nil.
    #[error("entity IDs must be non-nil UUID version 4 values")]
    InvalidVersion,
}

macro_rules! entity_id {
    ($name:ident, $doc:literal) => {
        #[doc = $doc]
        #[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
        pub struct $name(Uuid);

        impl $name {
            /// Generates a new UUID version 4 entity ID.
            #[must_use]
            pub fn new() -> Self {
                Self(Uuid::new_v4())
            }

            /// Constructs a typed ID from a UUID version 4 value.
            ///
            /// # Errors
            ///
            /// Returns [`IdError::InvalidVersion`] for nil or non-v4 values.
            pub fn from_uuid(value: Uuid) -> Result<Self, IdError> {
                if value.is_nil() || value.get_version() != Some(Version::Random) {
                    return Err(IdError::InvalidVersion);
                }
                Ok(Self(value))
            }

            /// Returns the underlying UUID.
            #[must_use]
            pub const fn as_uuid(self) -> Uuid {
                self.0
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.hyphenated().fmt(formatter)
            }
        }

        impl FromStr for $name {
            type Err = IdError;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                let uuid = Uuid::parse_str(value)
                    .map_err(|error| IdError::InvalidUuid(error.to_string()))?;
                Self::from_uuid(uuid)
            }
        }

        impl Serialize for $name {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: Serializer,
            {
                serializer.serialize_str(&self.to_string())
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: Deserializer<'de>,
            {
                let value = String::deserialize(deserializer)?;
                value.parse().map_err(de::Error::custom)
            }
        }
    };
}

entity_id!(DocumentId, "The stable identity of a document.");
entity_id!(PieceId, "The stable identity of a playable piece.");
entity_id!(MaterialId, "The stable identity of authored material.");
entity_id!(VoiceId, "The stable identity of a voice.");
entity_id!(NoteId, "The stable identity of a phrase note.");

/// Document-level descriptive information.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Metadata {
    title: Option<String>,
    composer: Option<String>,
    description: Option<String>,
}

impl Metadata {
    /// Constructs empty metadata.
    #[must_use]
    pub const fn new() -> Self {
        Self {
            title: None,
            composer: None,
            description: None,
        }
    }

    /// Sets the human-readable title.
    #[must_use]
    pub fn with_title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    /// Sets the composer's display name.
    #[must_use]
    pub fn with_composer(mut self, composer: impl Into<String>) -> Self {
        self.composer = Some(composer.into());
        self
    }

    /// Sets a longer description.
    #[must_use]
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    /// Returns the title when one is present.
    #[must_use]
    pub fn title(&self) -> Option<&str> {
        self.title.as_deref()
    }

    /// Returns the composer when one is present.
    #[must_use]
    pub fn composer(&self) -> Option<&str> {
        self.composer.as_deref()
    }

    /// Returns the description when one is present.
    #[must_use]
    pub fn description(&self) -> Option<&str> {
        self.description.as_deref()
    }
}

/// The root seed selecting a repeatable realization.
#[derive(Clone, Copy, Debug, Default, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct Seed(u64);

impl Seed {
    /// Constructs a seed from all 64 bits of an integer.
    #[must_use]
    pub const fn new(value: u64) -> Self {
        Self(value)
    }

    /// Returns the seed's integer value.
    #[must_use]
    pub const fn value(self) -> u64 {
        self.0
    }
}

impl fmt::Display for Seed {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{:016x}", self.0)
    }
}

impl FromStr for Seed {
    type Err = ParseSeedError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        if value.len() != 16
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(ParseSeedError);
        }
        u64::from_str_radix(value, 16)
            .map(Self)
            .map_err(|_| ParseSeedError)
    }
}

impl Serialize for Seed {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Seed {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        value.parse().map_err(de::Error::custom)
    }
}

/// An error returned for a noncanonical seed string.
#[derive(Clone, Copy, Debug, Eq, Error, PartialEq)]
#[error("seed must be exactly 16 lowercase hexadecimal characters")]
pub struct ParseSeedError;

/// Shared metric settings. Absolute-time material does not depend on this value.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Transport {
    tempo: Tempo,
    meter: Option<Meter>,
}

impl Transport {
    /// Constructs transport settings with optional metric grouping.
    #[must_use]
    pub const fn new(tempo: Tempo, meter: Option<Meter>) -> Self {
        Self { tempo, meter }
    }

    /// Returns the constant tempo.
    #[must_use]
    pub const fn tempo(&self) -> Tempo {
        self.tempo
    }

    /// Returns metric grouping when the piece declares one.
    #[must_use]
    pub const fn meter(&self) -> Option<Meter> {
        self.meter
    }
}

/// An invalid value supplied to a musical document constructor.
#[derive(Clone, Copy, Debug, Eq, Error, PartialEq)]
pub enum DocumentValueError {
    /// A note had a negative onset or non-positive duration.
    #[error("note onset must be non-negative and duration must be positive")]
    InvalidNoteTime,
    /// Note velocity was outside `1..=127`.
    #[error("note velocity must be between 1 and 127")]
    InvalidVelocity,
    /// A step pattern had no steps.
    #[error("step pattern must contain at least one step")]
    EmptySteps,
    /// A step pattern subdivision was not positive.
    #[error("step subdivision must be positive")]
    InvalidSubdivision,
    /// A step pattern had no pitch rows.
    #[error("step pattern must contain at least one row")]
    EmptyRows,
    /// A symbolic reference was empty or whitespace.
    #[error("symbolic reference must not be empty")]
    EmptyReference,
}

/// A note's position and duration in one explicit clock domain.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "clock", rename_all = "snake_case")]
pub enum NoteTime {
    /// A note measured in quarter-note beats.
    Metric {
        /// Onset measured from the piece origin.
        onset: Beats,
        /// Duration in quarter-note beats.
        duration: Beats,
    },
    /// A note measured in elapsed seconds without a tempo dependency.
    Absolute {
        /// Onset measured from the piece origin.
        onset: AbsoluteTime,
        /// Exact duration in seconds.
        duration: AbsoluteDuration,
    },
}

impl NoteTime {
    fn is_valid(&self) -> bool {
        match self {
            Self::Metric { onset, duration } => !onset.is_negative() && duration.is_positive(),
            Self::Absolute { duration, .. } => !duration.is_zero(),
        }
    }
}

/// A pitched note retained in a phrase.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Note {
    id: NoteId,
    pitch: Pitch,
    time: NoteTime,
    velocity: u8,
}

impl Note {
    /// Constructs a note. Velocity uses the inclusive normalized integer range `1..=127`.
    ///
    /// # Errors
    ///
    /// Returns an error for negative onsets, non-positive durations, or invalid velocity.
    pub fn new(
        id: NoteId,
        pitch: Pitch,
        time: NoteTime,
        velocity: u8,
    ) -> Result<Self, DocumentValueError> {
        if !time.is_valid() {
            return Err(DocumentValueError::InvalidNoteTime);
        }
        if !(1..=127).contains(&velocity) {
            return Err(DocumentValueError::InvalidVelocity);
        }
        Ok(Self {
            id,
            pitch,
            time,
            velocity,
        })
    }

    /// Returns the note ID.
    #[must_use]
    pub const fn id(&self) -> NoteId {
        self.id
    }

    /// Returns the note pitch.
    #[must_use]
    pub const fn pitch(&self) -> Pitch {
        self.pitch
    }

    /// Returns the note timing.
    #[must_use]
    pub const fn time(&self) -> &NoteTime {
        &self.time
    }

    /// Returns the note velocity.
    #[must_use]
    pub const fn velocity(&self) -> u8 {
        self.velocity
    }
}

/// Arbitrarily timed note material, including unquantized absolute-time input.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Phrase {
    notes: BTreeMap<NoteId, Note>,
}

impl Phrase {
    /// Constructs an empty phrase.
    #[must_use]
    pub const fn new() -> Self {
        Self {
            notes: BTreeMap::new(),
        }
    }

    /// Returns notes in stable ID order.
    #[must_use]
    pub const fn notes(&self) -> &BTreeMap<NoteId, Note> {
        &self.notes
    }
}

impl Default for Phrase {
    fn default() -> Self {
        Self::new()
    }
}

/// A row in a step pattern.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StepRow {
    pitch: Pitch,
    cells: Vec<bool>,
}

impl StepRow {
    /// Constructs an inactive pitch row with the requested number of steps.
    #[must_use]
    pub fn new(pitch: Pitch, steps: usize) -> Self {
        Self {
            pitch,
            cells: vec![false; steps],
        }
    }

    /// Returns the row pitch.
    #[must_use]
    pub const fn pitch(&self) -> Pitch {
        self.pitch
    }

    /// Returns active/inactive cell values.
    #[must_use]
    pub fn cells(&self) -> &[bool] {
        &self.cells
    }
}

/// Quantized pitch rows sharing a fixed step count and beat subdivision.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StepPattern {
    steps: usize,
    subdivision: Beats,
    rows: Vec<StepRow>,
}

impl StepPattern {
    /// Constructs a step pattern with inactive pitch rows.
    ///
    /// # Errors
    ///
    /// Returns an error when steps or rows are empty or subdivision is not positive.
    pub fn new(
        steps: usize,
        subdivision: Beats,
        pitches: impl IntoIterator<Item = Pitch>,
    ) -> Result<Self, DocumentValueError> {
        if steps == 0 {
            return Err(DocumentValueError::EmptySteps);
        }
        if !subdivision.is_positive() {
            return Err(DocumentValueError::InvalidSubdivision);
        }
        let rows: Vec<_> = pitches
            .into_iter()
            .map(|pitch| StepRow::new(pitch, steps))
            .collect();
        if rows.is_empty() {
            return Err(DocumentValueError::EmptyRows);
        }
        Ok(Self {
            steps,
            subdivision,
            rows,
        })
    }

    /// Returns the number of steps.
    #[must_use]
    pub const fn steps(&self) -> usize {
        self.steps
    }

    /// Returns each step's duration in quarter-note beats.
    #[must_use]
    pub const fn subdivision(&self) -> Beats {
        self.subdivision
    }

    /// Returns pitch rows in authored order.
    #[must_use]
    pub fn rows(&self) -> &[StepRow] {
        &self.rows
    }
}

/// One authored material object.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Material {
    /// Freely timed phrase material.
    Phrase {
        /// Stable material identity.
        id: MaterialId,
        /// Human-readable material name.
        name: String,
        /// Phrase content.
        phrase: Phrase,
    },
    /// Quantized step-pattern material.
    StepPattern {
        /// Stable material identity.
        id: MaterialId,
        /// Human-readable material name.
        name: String,
        /// Step-pattern content.
        pattern: StepPattern,
    },
}

impl Material {
    /// Constructs phrase material.
    #[must_use]
    pub fn phrase(id: MaterialId, name: impl Into<String>, phrase: Phrase) -> Self {
        Self::Phrase {
            id,
            name: name.into(),
            phrase,
        }
    }

    /// Constructs step-pattern material.
    #[must_use]
    pub fn step_pattern(id: MaterialId, name: impl Into<String>, pattern: StepPattern) -> Self {
        Self::StepPattern {
            id,
            name: name.into(),
            pattern,
        }
    }

    /// Returns the stable material ID.
    #[must_use]
    pub const fn id(&self) -> MaterialId {
        match self {
            Self::Phrase { id, .. } | Self::StepPattern { id, .. } => *id,
        }
    }

    /// Returns the material's display name.
    #[must_use]
    pub fn name(&self) -> &str {
        match self {
            Self::Phrase { name, .. } | Self::StepPattern { name, .. } => name,
        }
    }
}

/// A symbolic sound preset reference independent of an audio runtime.
#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct SoundRef(String);

impl SoundRef {
    /// Constructs a non-empty sound reference.
    ///
    /// # Errors
    ///
    /// Returns an error when the reference is empty or only whitespace.
    pub fn new(value: impl Into<String>) -> Result<Self, DocumentValueError> {
        let value = value.into();
        if value.trim().is_empty() {
            Err(DocumentValueError::EmptyReference)
        } else {
            Ok(Self(value))
        }
    }

    /// Returns the symbolic sound ID.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// A persisted voice parameter value with no Web Audio or Tone.js coupling.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum ParameterValue {
    /// A switch-like parameter.
    Boolean(bool),
    /// A signed integral parameter.
    Integer(i64),
    /// A symbolic or textual parameter.
    Text(String),
}

/// Editable voice properties.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct VoiceSettings {
    name: String,
    material: Option<MaterialId>,
    sound: SoundRef,
    enabled: bool,
    parameters: BTreeMap<String, ParameterValue>,
}

impl VoiceSettings {
    /// Constructs voice settings with no material and no custom parameters.
    #[must_use]
    pub fn new(name: impl Into<String>, sound: SoundRef) -> Self {
        Self {
            name: name.into(),
            material: None,
            sound,
            enabled: true,
            parameters: BTreeMap::new(),
        }
    }

    /// Associates the voice with material.
    #[must_use]
    pub const fn with_material(mut self, material: MaterialId) -> Self {
        self.material = Some(material);
        self
    }

    /// Adds or replaces a symbolic parameter.
    #[must_use]
    pub fn with_parameter(mut self, name: impl Into<String>, value: ParameterValue) -> Self {
        self.parameters.insert(name.into(), value);
        self
    }

    /// Sets whether the voice participates in playback.
    #[must_use]
    pub const fn with_enabled(mut self, enabled: bool) -> Self {
        self.enabled = enabled;
        self
    }

    /// Returns the display name.
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Returns referenced material when present.
    #[must_use]
    pub const fn material(&self) -> Option<MaterialId> {
        self.material
    }

    /// Returns the symbolic sound reference.
    #[must_use]
    pub const fn sound(&self) -> &SoundRef {
        &self.sound
    }

    /// Reports whether the voice is enabled.
    #[must_use]
    pub const fn enabled(&self) -> bool {
        self.enabled
    }

    /// Returns voice parameters in stable key order.
    #[must_use]
    pub const fn parameters(&self) -> &BTreeMap<String, ParameterValue> {
        &self.parameters
    }
}

/// A playable role connecting material to a symbolic sound.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Voice {
    id: VoiceId,
    settings: VoiceSettings,
}

impl Voice {
    /// Constructs a voice.
    #[must_use]
    pub const fn new(id: VoiceId, settings: VoiceSettings) -> Self {
        Self { id, settings }
    }

    /// Returns the stable voice ID.
    #[must_use]
    pub const fn id(&self) -> VoiceId {
        self.id
    }

    /// Returns current settings.
    #[must_use]
    pub const fn settings(&self) -> &VoiceSettings {
        &self.settings
    }
}

/// The playable musical system within a document.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Piece {
    id: PieceId,
    transport: Transport,
    materials: BTreeMap<MaterialId, Material>,
    voices: BTreeMap<VoiceId, Voice>,
}

impl Piece {
    /// Constructs an empty piece with transport settings.
    #[must_use]
    pub const fn new(id: PieceId, transport: Transport) -> Self {
        Self {
            id,
            transport,
            materials: BTreeMap::new(),
            voices: BTreeMap::new(),
        }
    }

    /// Returns the stable piece ID.
    #[must_use]
    pub const fn id(&self) -> PieceId {
        self.id
    }

    /// Returns shared transport settings.
    #[must_use]
    pub const fn transport(&self) -> &Transport {
        &self.transport
    }

    /// Returns materials in stable ID order.
    #[must_use]
    pub const fn materials(&self) -> &BTreeMap<MaterialId, Material> {
        &self.materials
    }

    /// Returns voices in stable ID order.
    #[must_use]
    pub const fn voices(&self) -> &BTreeMap<VoiceId, Voice> {
        &self.voices
    }
}

/// The versioned persisted root and sole mutation boundary.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Document {
    format: String,
    schema_version: u32,
    id: DocumentId,
    metadata: Metadata,
    seed: Seed,
    piece: Piece,
}

impl Document {
    /// Constructs a current-schema document.
    #[must_use]
    pub fn new(id: DocumentId, metadata: Metadata, seed: Seed, piece: Piece) -> Self {
        Self {
            format: FORMAT.to_owned(),
            schema_version: SCHEMA_VERSION,
            id,
            metadata,
            seed,
            piece,
        }
    }

    /// Returns the document ID.
    #[must_use]
    pub const fn id(&self) -> DocumentId {
        self.id
    }

    /// Returns the schema version.
    #[must_use]
    pub const fn schema_version(&self) -> u32 {
        self.schema_version
    }

    /// Returns descriptive metadata.
    #[must_use]
    pub const fn metadata(&self) -> &Metadata {
        &self.metadata
    }

    /// Returns the composition seed.
    #[must_use]
    pub const fn seed(&self) -> Seed {
        self.seed
    }

    /// Returns the playable piece.
    #[must_use]
    pub const fn piece(&self) -> &Piece {
        &self.piece
    }

    /// Serializes the current document as canonical pretty JSON ending in a newline.
    ///
    /// # Errors
    ///
    /// Returns [`SaveError`] when JSON encoding fails.
    pub fn to_json(&self) -> Result<String, SaveError> {
        let diagnostics = self.validate();
        if diagnostics
            .iter()
            .any(|item| item.severity == Severity::Error)
        {
            return Err(SaveError::InvalidDocument(diagnostics));
        }
        let mut output = serde_json::to_string_pretty(self)?;
        output.push('\n');
        Ok(output)
    }

    /// Loads, strictly deserializes, and validates a current-schema document.
    ///
    /// # Errors
    ///
    /// Returns [`LoadError`] for malformed JSON, invalid headers, unsupported schemas,
    /// unknown fields, invalid IDs, or semantic validation failures.
    pub fn from_json(input: &str) -> Result<Self, LoadError> {
        let value: serde_json::Value = serde_json::from_str(input)?;
        let object = value.as_object().ok_or_else(|| {
            LoadError::InvalidHeader("document root must be an object".to_owned())
        })?;
        match object.get("format").and_then(serde_json::Value::as_str) {
            Some(FORMAT) => {}
            _ => {
                return Err(LoadError::InvalidHeader(
                    "format must be `ambiente`".to_owned(),
                ));
            }
        }
        let schema = object
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| {
                LoadError::InvalidHeader("schema_version must be a positive integer".to_owned())
            })?;
        let schema = u32::try_from(schema).map_err(|_| {
            LoadError::InvalidHeader("schema_version exceeds the supported range".to_owned())
        })?;
        if schema == 0 {
            return Err(LoadError::InvalidHeader(
                "schema_version must be positive".to_owned(),
            ));
        }
        if schema != SCHEMA_VERSION {
            return Err(LoadError::UnsupportedSchema {
                found: schema,
                supported: SCHEMA_VERSION,
            });
        }
        let document: Self = serde_json::from_value(value)?;
        let diagnostics = document.validate();
        if diagnostics
            .iter()
            .any(|item| item.severity == Severity::Error)
        {
            return Err(LoadError::InvalidDocument(diagnostics));
        }
        Ok(document)
    }

    /// Reports all independent semantic problems in this document.
    #[must_use]
    pub fn validate(&self) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();
        if self.format != FORMAT {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::FormatInvalid,
                None,
                "format must be `ambiente`",
                None,
            ));
        }
        if self.schema_version != SCHEMA_VERSION {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::SchemaUnsupported,
                None,
                "document schema version is not supported",
                None,
            ));
        }
        validate_metadata(&self.metadata, &mut diagnostics);
        for (id, material) in &self.piece.materials {
            if *id != material.id() {
                diagnostics.push(Diagnostic::error(
                    DiagnosticCode::IdentityMismatch,
                    Some(DiagnosticLocation::new(id.to_string(), None)),
                    "material map key does not match the material ID",
                    None,
                ));
            }
            validate_material(material, &mut diagnostics);
        }
        for (id, voice) in &self.piece.voices {
            if *id != voice.id {
                diagnostics.push(Diagnostic::error(
                    DiagnosticCode::IdentityMismatch,
                    Some(DiagnosticLocation::new(id.to_string(), None)),
                    "voice map key does not match the voice ID",
                    None,
                ));
            }
            validate_voice(voice, &self.piece.materials, &mut diagnostics);
        }
        diagnostics
    }

    /// Applies one named operation atomically.
    ///
    /// # Errors
    ///
    /// Returns [`OperationError`] when a target is absent, an ID conflicts, the target
    /// has the wrong material kind, a cell is out of bounds, or validation fails.
    pub fn apply(&mut self, operation: Operation) -> Result<(), OperationError> {
        let mut candidate = self.clone();
        candidate.apply_unchecked(operation)?;
        let diagnostics = candidate.validate();
        if diagnostics
            .iter()
            .any(|item| item.severity == Severity::Error)
        {
            return Err(OperationError::Validation(diagnostics));
        }
        *self = candidate;
        Ok(())
    }

    #[allow(clippy::too_many_lines)]
    fn apply_unchecked(&mut self, operation: Operation) -> Result<(), OperationError> {
        match operation {
            Operation::SetMetadata(metadata) => self.metadata = metadata,
            Operation::SetSeed(seed) => self.seed = seed,
            Operation::AddMaterial(material) => {
                let id = material.id();
                if self.piece.materials.insert(id, material).is_some() {
                    return Err(OperationError::AlreadyExists {
                        entity: "material",
                        id: id.to_string(),
                    });
                }
            }
            Operation::RemoveMaterial(id) => {
                self.piece
                    .materials
                    .remove(&id)
                    .ok_or_else(|| OperationError::NotFound {
                        entity: "material",
                        id: id.to_string(),
                    })?;
            }
            Operation::UpdateMaterial(material) => {
                let id = material.id();
                let stored =
                    self.piece
                        .materials
                        .get_mut(&id)
                        .ok_or_else(|| OperationError::NotFound {
                            entity: "material",
                            id: id.to_string(),
                        })?;
                *stored = material;
            }
            Operation::AddVoice(voice) => {
                let id = voice.id;
                if self.piece.voices.insert(id, voice).is_some() {
                    return Err(OperationError::AlreadyExists {
                        entity: "voice",
                        id: id.to_string(),
                    });
                }
            }
            Operation::RemoveVoice(id) => {
                self.piece
                    .voices
                    .remove(&id)
                    .ok_or_else(|| OperationError::NotFound {
                        entity: "voice",
                        id: id.to_string(),
                    })?;
            }
            Operation::UpdateVoiceSettings { id, settings } => {
                let voice =
                    self.piece
                        .voices
                        .get_mut(&id)
                        .ok_or_else(|| OperationError::NotFound {
                            entity: "voice",
                            id: id.to_string(),
                        })?;
                voice.settings = settings;
            }
            Operation::InsertNote { material_id, note } => {
                let material = self.piece.materials.get_mut(&material_id).ok_or_else(|| {
                    OperationError::NotFound {
                        entity: "material",
                        id: material_id.to_string(),
                    }
                })?;
                let Material::Phrase { phrase, .. } = material else {
                    return Err(OperationError::WrongMaterialKind {
                        id: material_id.to_string(),
                        expected: "phrase",
                    });
                };
                let note_id = note.id;
                if phrase.notes.insert(note_id, note).is_some() {
                    return Err(OperationError::AlreadyExists {
                        entity: "note",
                        id: note_id.to_string(),
                    });
                }
            }
            Operation::RemoveNote {
                material_id,
                note_id,
            } => {
                let material = self.piece.materials.get_mut(&material_id).ok_or_else(|| {
                    OperationError::NotFound {
                        entity: "material",
                        id: material_id.to_string(),
                    }
                })?;
                let Material::Phrase { phrase, .. } = material else {
                    return Err(OperationError::WrongMaterialKind {
                        id: material_id.to_string(),
                        expected: "phrase",
                    });
                };
                phrase
                    .notes
                    .remove(&note_id)
                    .ok_or_else(|| OperationError::NotFound {
                        entity: "note",
                        id: note_id.to_string(),
                    })?;
            }
            Operation::UpdateMatrixCell {
                material_id,
                row,
                step,
                active,
            } => {
                let material = self.piece.materials.get_mut(&material_id).ok_or_else(|| {
                    OperationError::NotFound {
                        entity: "material",
                        id: material_id.to_string(),
                    }
                })?;
                let Material::StepPattern { pattern, .. } = material else {
                    return Err(OperationError::WrongMaterialKind {
                        id: material_id.to_string(),
                        expected: "step_pattern",
                    });
                };
                let cell = pattern
                    .rows
                    .get_mut(row)
                    .and_then(|pattern_row| pattern_row.cells.get_mut(step))
                    .ok_or(OperationError::CellOutOfBounds { row, step })?;
                *cell = active;
            }
        }
        Ok(())
    }
}

/// A bounded semantic change to a document.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Operation {
    /// Replaces document metadata.
    SetMetadata(Metadata),
    /// Changes the root composition seed.
    SetSeed(Seed),
    /// Adds authored material.
    AddMaterial(Material),
    /// Removes unreferenced authored material.
    RemoveMaterial(MaterialId),
    /// Replaces material while preserving its ID.
    UpdateMaterial(Material),
    /// Adds a voice.
    AddVoice(Voice),
    /// Removes a voice.
    RemoveVoice(VoiceId),
    /// Replaces editable settings for one voice.
    UpdateVoiceSettings {
        /// Target voice.
        id: VoiceId,
        /// Complete replacement settings.
        settings: VoiceSettings,
    },
    /// Inserts one note into phrase material.
    InsertNote {
        /// Target phrase material.
        material_id: MaterialId,
        /// Note to insert.
        note: Note,
    },
    /// Removes one note from phrase material.
    RemoveNote {
        /// Target phrase material.
        material_id: MaterialId,
        /// Note to remove.
        note_id: NoteId,
    },
    /// Sets one active/inactive step-pattern cell.
    UpdateMatrixCell {
        /// Target step-pattern material.
        material_id: MaterialId,
        /// Zero-based pitch row.
        row: usize,
        /// Zero-based step index.
        step: usize,
        /// New cell state.
        active: bool,
    },
}

/// A failure to apply a document operation.
#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum OperationError {
    /// The operation attempted to reuse an existing stable ID.
    #[error("{entity} `{id}` already exists")]
    AlreadyExists {
        /// Kind of entity.
        entity: &'static str,
        /// Conflicting ID.
        id: String,
    },
    /// The operation targeted an absent entity.
    #[error("{entity} `{id}` was not found")]
    NotFound {
        /// Kind of entity.
        entity: &'static str,
        /// Missing ID.
        id: String,
    },
    /// The material exists but cannot accept the requested edit.
    #[error("material `{id}` must be {expected} material")]
    WrongMaterialKind {
        /// Target material ID.
        id: String,
        /// Required kind.
        expected: &'static str,
    },
    /// A matrix coordinate lies outside the target pattern.
    #[error("matrix cell at row {row}, step {step} is out of bounds")]
    CellOutOfBounds {
        /// Requested row.
        row: usize,
        /// Requested step.
        step: usize,
    },
    /// The operation would violate document invariants.
    #[error("operation would make the document invalid")]
    Validation(Vec<Diagnostic>),
}

/// A canonical serialization failure.
#[derive(Debug, Error)]
pub enum SaveError {
    /// JSON encoding failed.
    #[error("could not serialize document: {0}")]
    Json(#[from] serde_json::Error),
    /// Semantic validation failed before serialization.
    #[error("document failed validation")]
    InvalidDocument(Vec<Diagnostic>),
}

/// A strict document loading failure.
#[derive(Debug, Error)]
pub enum LoadError {
    /// JSON parsing or strict deserialization failed.
    #[error("could not parse document: {0}")]
    Json(#[from] serde_json::Error),
    /// The format sentinel or schema header was malformed.
    #[error("invalid document header: {0}")]
    InvalidHeader(String),
    /// The document uses a schema this build cannot load.
    #[error("document schema {found} is unsupported; this build supports schema {supported}")]
    UnsupportedSchema {
        /// Version found in the file.
        found: u32,
        /// Current supported version.
        supported: u32,
    },
    /// Semantic validation failed after deserialization.
    #[error("document failed validation")]
    InvalidDocument(Vec<Diagnostic>),
}

/// A stable machine-readable validation category.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum DiagnosticCode {
    /// The format sentinel is wrong.
    #[serde(rename = "format.invalid")]
    FormatInvalid,
    /// The schema version is unsupported.
    #[serde(rename = "schema.unsupported")]
    SchemaUnsupported,
    /// A display name or symbolic key is empty.
    #[serde(rename = "value.empty")]
    ValueEmpty,
    /// A reference points to an absent entity.
    #[serde(rename = "reference.missing")]
    ReferenceMissing,
    /// A map key differs from the contained entity's ID.
    #[serde(rename = "identity.mismatch")]
    IdentityMismatch,
    /// A time or duration is outside its permitted range.
    #[serde(rename = "time.invalid")]
    TimeInvalid,
    /// A numeric value is outside its permitted range.
    #[serde(rename = "range.invalid")]
    RangeInvalid,
    /// A matrix shape is inconsistent.
    #[serde(rename = "pattern.invalid")]
    PatternInvalid,
}

/// Diagnostic importance.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    /// The document cannot be accepted.
    Error,
    /// The document is valid but may deserve attention.
    Warning,
}

/// A semantic object and optional field associated with a diagnostic.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DiagnosticLocation {
    object_id: String,
    field: Option<String>,
}

impl DiagnosticLocation {
    /// Constructs a semantic diagnostic location.
    #[must_use]
    pub fn new(object_id: String, field: Option<String>) -> Self {
        Self { object_id, field }
    }

    /// Returns the entity ID or root object label.
    #[must_use]
    pub fn object_id(&self) -> &str {
        &self.object_id
    }

    /// Returns the relevant semantic field.
    #[must_use]
    pub fn field(&self) -> Option<&str> {
        self.field.as_deref()
    }
}

/// One user-facing semantic validation result.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Diagnostic {
    code: DiagnosticCode,
    severity: Severity,
    message: String,
    location: Option<DiagnosticLocation>,
    help: Option<String>,
}

impl Diagnostic {
    fn error(
        code: DiagnosticCode,
        location: Option<DiagnosticLocation>,
        message: impl Into<String>,
        help: Option<String>,
    ) -> Self {
        Self {
            code,
            severity: Severity::Error,
            message: message.into(),
            location,
            help,
        }
    }

    /// Returns the stable category.
    #[must_use]
    pub const fn code(&self) -> DiagnosticCode {
        self.code
    }

    /// Returns the severity.
    #[must_use]
    pub const fn severity(&self) -> Severity {
        self.severity
    }

    /// Returns the human-readable explanation.
    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    /// Returns the semantic location when available.
    #[must_use]
    pub const fn location(&self) -> Option<&DiagnosticLocation> {
        self.location.as_ref()
    }

    /// Returns correction guidance when available.
    #[must_use]
    pub fn help(&self) -> Option<&str> {
        self.help.as_deref()
    }
}

fn validate_metadata(metadata: &Metadata, diagnostics: &mut Vec<Diagnostic>) {
    for (field, value) in [
        ("title", metadata.title.as_deref()),
        ("composer", metadata.composer.as_deref()),
        ("description", metadata.description.as_deref()),
    ] {
        if value.is_some_and(|item| item.trim().is_empty()) {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::ValueEmpty,
                Some(DiagnosticLocation::new(
                    "document".to_owned(),
                    Some(field.to_owned()),
                )),
                format!("metadata {field} must not be empty when present"),
                Some(format!("remove {field} or provide text")),
            ));
        }
    }
}

fn validate_material(material: &Material, diagnostics: &mut Vec<Diagnostic>) {
    let location = |field: &str| {
        Some(DiagnosticLocation::new(
            material.id().to_string(),
            Some(field.to_owned()),
        ))
    };
    if material.name().trim().is_empty() {
        diagnostics.push(Diagnostic::error(
            DiagnosticCode::ValueEmpty,
            location("name"),
            "material name must not be empty",
            Some("provide a material name".to_owned()),
        ));
    }
    match material {
        Material::Phrase { phrase, .. } => {
            for (id, note) in &phrase.notes {
                if *id != note.id {
                    diagnostics.push(Diagnostic::error(
                        DiagnosticCode::IdentityMismatch,
                        Some(DiagnosticLocation::new(id.to_string(), None)),
                        "note map key does not match the note ID",
                        None,
                    ));
                }
                if !note.time.is_valid() {
                    diagnostics.push(Diagnostic::error(
                        DiagnosticCode::TimeInvalid,
                        Some(DiagnosticLocation::new(
                            note.id.to_string(),
                            Some("time".to_owned()),
                        )),
                        "note onset must be non-negative and duration must be positive",
                        None,
                    ));
                }
                if !(1..=127).contains(&note.velocity) {
                    diagnostics.push(Diagnostic::error(
                        DiagnosticCode::RangeInvalid,
                        Some(DiagnosticLocation::new(
                            note.id.to_string(),
                            Some("velocity".to_owned()),
                        )),
                        "note velocity must be between 1 and 127",
                        None,
                    ));
                }
            }
        }
        Material::StepPattern { pattern, .. } => {
            if pattern.steps == 0 || pattern.rows.is_empty() || !pattern.subdivision.is_positive() {
                diagnostics.push(Diagnostic::error(
                    DiagnosticCode::PatternInvalid,
                    location("pattern"),
                    "step pattern requires steps, rows, and a positive subdivision",
                    None,
                ));
            }
            for row in &pattern.rows {
                if row.cells.len() != pattern.steps {
                    diagnostics.push(Diagnostic::error(
                        DiagnosticCode::PatternInvalid,
                        location("rows"),
                        "every step-pattern row must match the declared step count",
                        None,
                    ));
                }
            }
        }
    }
}

fn validate_voice(
    voice: &Voice,
    materials: &BTreeMap<MaterialId, Material>,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let location = |field: &str| {
        Some(DiagnosticLocation::new(
            voice.id.to_string(),
            Some(field.to_owned()),
        ))
    };
    if voice.settings.name.trim().is_empty() {
        diagnostics.push(Diagnostic::error(
            DiagnosticCode::ValueEmpty,
            location("name"),
            "voice name must not be empty",
            Some("provide a voice name".to_owned()),
        ));
    }
    if voice.settings.sound.0.trim().is_empty() {
        diagnostics.push(Diagnostic::error(
            DiagnosticCode::ValueEmpty,
            location("sound"),
            "sound reference must not be empty",
            Some("provide a symbolic sound reference".to_owned()),
        ));
    }
    if let Some(material) = voice.settings.material {
        if !materials.contains_key(&material) {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::ReferenceMissing,
                location("material"),
                format!("referenced material `{material}` does not exist"),
                Some("add the material or choose an existing material".to_owned()),
            ));
        }
    }
    for name in voice.settings.parameters.keys() {
        if name.trim().is_empty() {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::ValueEmpty,
                location("parameters"),
                "voice parameter names must not be empty",
                None,
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id<T: FromStr>(value: &str) -> T
    where
        T::Err: fmt::Debug,
    {
        value.parse().unwrap()
    }

    fn fixture() -> Document {
        let tempo = Tempo::new(120, 1).unwrap();
        Document::new(
            id("9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860"),
            Metadata::new().with_title("Study"),
            Seed::new(42),
            Piece::new(
                id("98d4060e-3f83-4299-8932-9cf757a16a76"),
                Transport::new(tempo, Some(Meter::new(4, 4).unwrap())),
            ),
        )
    }

    #[test]
    fn minimal_document_round_trips_canonically() {
        let document = fixture();
        let json = document.to_json().unwrap();
        assert!(json.ends_with('\n'));
        assert!(json.contains("\"format\": \"ambiente\""));
        assert!(json.contains("\"schema_version\": 1"));
        assert!(json.contains("\"seed\": \"000000000000002a\""));
        let loaded = Document::from_json(&json).unwrap();
        assert_eq!(loaded, document);
        assert_eq!(loaded.to_json().unwrap(), json);
    }

    #[test]
    fn strict_loading_rejects_unknown_fields_and_nil_ids() {
        let json = fixture().to_json().unwrap();
        let unknown = json.replacen('{', "{\n  \"unknown\": true,", 1);
        assert!(matches!(
            Document::from_json(&unknown),
            Err(LoadError::Json(_))
        ));
        let nil = json.replace(
            "9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860",
            "00000000-0000-0000-0000-000000000000",
        );
        assert!(matches!(Document::from_json(&nil), Err(LoadError::Json(_))));
    }

    #[test]
    fn operations_edit_material_voice_note_and_matrix() {
        let mut document = fixture();
        let phrase_id = id("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        let matrix_id = id("313b2f8d-8c00-4d82-82f6-cdb7aeb112de");
        document
            .apply(Operation::AddMaterial(Material::phrase(
                phrase_id,
                "Phrase",
                Phrase::new(),
            )))
            .unwrap();
        let pattern = StepPattern::new(
            4,
            Beats::new(1, 4).unwrap(),
            [Pitch::from_semitones(48), Pitch::from_semitones(55)],
        )
        .unwrap();
        document
            .apply(Operation::AddMaterial(Material::step_pattern(
                matrix_id, "Matrix", pattern,
            )))
            .unwrap();
        let voice_id = id("826b8913-4c23-43e1-b150-594737909a58");
        let sound = SoundRef::new("felt-piano").unwrap();
        document
            .apply(Operation::AddVoice(Voice::new(
                voice_id,
                VoiceSettings::new("Piano", sound).with_material(phrase_id),
            )))
            .unwrap();
        let pitch = Pitch::in_register(PitchClass::new(0).unwrap(), Register::new(4)).unwrap();
        let note_id = id("92b8d664-2b27-45ca-a7c2-f816124fe813");
        let note = Note::new(
            note_id,
            pitch,
            NoteTime::Metric {
                onset: Beats::new(0, 1).unwrap(),
                duration: Beats::new(1, 2).unwrap(),
            },
            96,
        )
        .unwrap();
        document
            .apply(Operation::InsertNote {
                material_id: phrase_id,
                note,
            })
            .unwrap();
        document
            .apply(Operation::UpdateMatrixCell {
                material_id: matrix_id,
                row: 1,
                step: 3,
                active: true,
            })
            .unwrap();
        assert!(document.validate().is_empty());
        assert_eq!(document.piece().voices().len(), 1);
        assert_eq!(
            Document::from_json(&document.to_json().unwrap()).unwrap(),
            document
        );

        document.apply(Operation::SetSeed(Seed::new(7))).unwrap();
        document
            .apply(Operation::UpdateVoiceSettings {
                id: voice_id,
                settings: VoiceSettings::new("Pattern", SoundRef::new("glass").unwrap())
                    .with_material(matrix_id),
            })
            .unwrap();
        let replacement =
            StepPattern::new(8, Beats::new(1, 2).unwrap(), [Pitch::from_semitones(60)]).unwrap();
        document
            .apply(Operation::UpdateMaterial(Material::step_pattern(
                matrix_id,
                "Longer matrix",
                replacement,
            )))
            .unwrap();
        document
            .apply(Operation::RemoveNote {
                material_id: phrase_id,
                note_id,
            })
            .unwrap();
        document.apply(Operation::RemoveVoice(voice_id)).unwrap();
        document
            .apply(Operation::RemoveMaterial(phrase_id))
            .unwrap();
        document
            .apply(Operation::RemoveMaterial(matrix_id))
            .unwrap();
        assert_eq!(document.seed(), Seed::new(7));
        assert!(document.piece().materials().is_empty());
        assert!(document.piece().voices().is_empty());
    }

    #[test]
    fn failed_operations_leave_the_document_unchanged() {
        let mut document = fixture();
        let before = document.clone();
        let missing: MaterialId = id("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        let voice = Voice::new(
            id("826b8913-4c23-43e1-b150-594737909a58"),
            VoiceSettings::new("Piano", SoundRef::new("felt-piano").unwrap())
                .with_material(missing),
        );
        assert!(matches!(
            document.apply(Operation::AddVoice(voice)),
            Err(OperationError::Validation(_))
        ));
        assert_eq!(document, before);
    }
}
