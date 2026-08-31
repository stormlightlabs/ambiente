//! Versioned musical documents, validation, and atomic edit operations.

use std::{collections::BTreeMap, fmt, marker::PhantomData, str::FromStr};

use serde::{
    Deserialize, Deserializer, Serialize, Serializer, de,
    de::{MapAccess, SeqAccess, Visitor},
};
use thiserror::Error;
use uuid::{Uuid, Version};

use crate::prelude::*;

/// The current persisted document schema version.
pub const SCHEMA_VERSION: u32 = 3;
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
entity_id!(
    MacroId,
    "The stable identity of a published high-level control."
);
entity_id!(
    PurposePresetId,
    "The stable identity of a listener-purpose preset."
);

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
    /// A phrase attempted to reuse a note identity.
    #[error("phrase note IDs must be unique")]
    DuplicateNote,
    /// A normalized macro value exceeded one hundred.
    #[error("macro value must be between 0 and 100")]
    MacroOutOfRange,
}

/// A note's position and duration in one explicit clock domain.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "clock", rename_all = "snake_case", deny_unknown_fields)]
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
    #[serde(deserialize_with = "deserialize_unique_map")]
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

    /// Inserts a validated note while preserving unique note identities.
    pub(crate) fn insert_note(&mut self, note: Note) -> Result<(), DocumentValueError> {
        match self.notes.entry(note.id()) {
            std::collections::btree_map::Entry::Vacant(entry) => {
                entry.insert(note);
                Ok(())
            }
            std::collections::btree_map::Entry::Occupied(_) => {
                Err(DocumentValueError::DuplicateNote)
            }
        }
    }
}

impl Default for Phrase {
    fn default() -> Self {
        Self::new()
    }
}

/// One extensible cell in a step pattern.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StepCell {
    active: bool,
}

impl StepCell {
    /// Constructs a cell with the requested activity state.
    #[must_use]
    pub const fn new(active: bool) -> Self {
        Self { active }
    }

    /// Reports whether the cell produces an event.
    #[must_use]
    pub const fn active(&self) -> bool {
        self.active
    }
}

/// A pitch row in a step pattern.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StepRow {
    pitch: Pitch,
    cells: Vec<StepCell>,
}

impl StepRow {
    /// Constructs an inactive pitch row with the requested number of steps.
    #[must_use]
    pub fn new(pitch: Pitch, steps: usize) -> Self {
        Self {
            pitch,
            cells: vec![StepCell::default(); steps],
        }
    }

    /// Returns the row pitch.
    #[must_use]
    pub const fn pitch(&self) -> Pitch {
        self.pitch
    }

    /// Returns the row's cells.
    #[must_use]
    pub fn cells(&self) -> &[StepCell] {
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

    /// Changes the matrix dimensions, subdivision, and row pitches while preserving
    /// overlapping cells by row and step position.
    ///
    /// # Errors
    ///
    /// Returns an error when steps or pitches are empty or subdivision is not positive.
    pub fn reconfigure(
        &mut self,
        steps: usize,
        subdivision: Beats,
        pitches: impl IntoIterator<Item = Pitch>,
    ) -> Result<(), DocumentValueError> {
        let mut replacement = Self::new(steps, subdivision, pitches)?;
        for (old_row, new_row) in self.rows.iter().zip(&mut replacement.rows) {
            for (old_cell, new_cell) in old_row.cells.iter().zip(&mut new_row.cells) {
                new_cell.active = old_cell.active;
            }
        }
        *self = replacement;
        Ok(())
    }
}

/// One authored material object.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
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
    /// A source collection of distinct pitches.
    PitchSet {
        /// Stable material identity.
        id: MaterialId,
        /// Human-readable material name.
        name: String,
        /// Available pitches.
        pitches: PitchSet,
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

    /// Constructs pitch-set material.
    #[must_use]
    pub fn pitch_set(id: MaterialId, name: impl Into<String>, pitches: PitchSet) -> Self {
        Self::PitchSet {
            id,
            name: name.into(),
            pitches,
        }
    }

    /// Returns the stable material ID.
    #[must_use]
    pub const fn id(&self) -> MaterialId {
        match self {
            Self::Phrase { id, .. } | Self::StepPattern { id, .. } | Self::PitchSet { id, .. } => {
                *id
            }
        }
    }

    /// Returns the material's display name.
    #[must_use]
    pub fn name(&self) -> &str {
        match self {
            Self::Phrase { name, .. }
            | Self::StepPattern { name, .. }
            | Self::PitchSet { name, .. } => name,
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

/// A normalized macro position from zero through one hundred.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct MacroValue(u8);

impl MacroValue {
    /// Constructs a normalized macro value.
    ///
    /// # Errors
    ///
    /// Returns [`DocumentValueError::MacroOutOfRange`] when `value` exceeds 100.
    pub const fn new(value: u8) -> Result<Self, DocumentValueError> {
        if value <= 100 {
            Ok(Self(value))
        } else {
            Err(DocumentValueError::MacroOutOfRange)
        }
    }

    /// Returns the normalized integer value.
    #[must_use]
    pub const fn value(self) -> u8 {
        self.0
    }

    fn interpolate(self, minimum: i64, maximum: i64) -> i64 {
        let span = i128::from(maximum) - i128::from(minimum);
        let scaled = span * i128::from(self.0);
        let rounded = (if scaled >= 0 {
            scaled + 50
        } else {
            scaled - 50
        }) / 100;
        i64::try_from(i128::from(minimum) + rounded).unwrap_or(if span >= 0 {
            i64::MAX
        } else {
            i64::MIN
        })
    }
}

impl<'de> Deserialize<'de> for MacroValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Self::new(u8::deserialize(deserializer)?).map_err(de::Error::custom)
    }
}

/// The listener-facing meaning of a published macro.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MacroSemantic {
    /// Controls how much activity is heard.
    Density,
    /// Controls the amount of audible change or modulation.
    Motion,
    /// Controls ambience and perceived spaciousness.
    Space,
    /// Controls spectral softness and harmonic warmth.
    Warmth,
    /// Controls overall energy without changing the transport volume.
    Intensity,
    /// Leaves the meaning entirely to the composer.
    Custom,
}

/// One low-level value driven by a published macro.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum MacroMapping {
    /// Maps the macro onto one integral semantic sound parameter.
    VoiceParameter {
        /// Voice receiving the resolved parameter.
        voice_id: VoiceId,
        /// Backend-independent parameter name.
        parameter: String,
        /// Value produced at macro position zero.
        minimum: i64,
        /// Value produced at macro position one hundred.
        maximum: i64,
    },
    /// Maps the macro onto an omit or conditional process probability.
    ProcessProbability {
        /// Stable stochastic process identity.
        pattern_id: PatternId,
        /// Percentage produced at macro position zero.
        minimum: MacroValue,
        /// Percentage produced at macro position one hundred.
        maximum: MacroValue,
    },
}

/// A composer-published high-level control over one or more canonical values.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Macro {
    id: MacroId,
    name: String,
    semantic: MacroSemantic,
    value: MacroValue,
    mappings: Vec<MacroMapping>,
}

impl Macro {
    /// Constructs a published macro and its initial position.
    #[must_use]
    pub fn new(
        id: MacroId,
        name: impl Into<String>,
        semantic: MacroSemantic,
        value: MacroValue,
    ) -> Self {
        Self {
            id,
            name: name.into(),
            semantic,
            value,
            mappings: Vec::new(),
        }
    }

    /// Adds one underlying value controlled by this macro.
    #[must_use]
    pub fn with_mapping(mut self, mapping: MacroMapping) -> Self {
        self.mappings.push(mapping);
        self
    }

    /// Returns the stable macro identity.
    #[must_use]
    pub const fn id(&self) -> MacroId {
        self.id
    }

    /// Returns the composer-facing label.
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Returns the high-level semantic role.
    #[must_use]
    pub const fn semantic(&self) -> &MacroSemantic {
        &self.semantic
    }

    /// Returns the current normalized position.
    #[must_use]
    pub const fn value(&self) -> MacroValue {
        self.value
    }

    /// Returns all underlying mappings in authored order.
    #[must_use]
    pub fn mappings(&self) -> &[MacroMapping] {
        &self.mappings
    }
}

/// A composer-authored listening purpose without product-wide efficacy claims.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Purpose {
    /// A restrained setting intended for concentration.
    Focus,
    /// A more active setting intended for making or ideation.
    Create,
    /// A quiet setting intended for unwinding.
    Rest,
    /// A composer-defined purpose.
    Custom,
}

/// A named set of authored macro values offered to listeners.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PurposePreset {
    id: PurposePresetId,
    name: String,
    purpose: Purpose,
    #[serde(deserialize_with = "deserialize_unique_map")]
    macro_values: BTreeMap<MacroId, MacroValue>,
}

impl PurposePreset {
    /// Constructs an empty authored purpose preset.
    #[must_use]
    pub fn new(id: PurposePresetId, name: impl Into<String>, purpose: Purpose) -> Self {
        Self {
            id,
            name: name.into(),
            purpose,
            macro_values: BTreeMap::new(),
        }
    }

    /// Adds or replaces one macro value in the preset.
    #[must_use]
    pub fn with_macro(mut self, macro_id: MacroId, value: MacroValue) -> Self {
        self.macro_values.insert(macro_id, value);
        self
    }

    /// Returns the stable preset identity.
    #[must_use]
    pub const fn id(&self) -> PurposePresetId {
        self.id
    }

    /// Returns the listener-facing preset name.
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Returns the authored purpose category.
    #[must_use]
    pub const fn purpose(&self) -> &Purpose {
        &self.purpose
    }

    /// Returns the macro values applied by this preset.
    #[must_use]
    pub const fn macro_values(&self) -> &BTreeMap<MacroId, MacroValue> {
        &self.macro_values
    }
}

/// Editable voice properties.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct VoiceSettings {
    name: String,
    pattern: Option<Pattern>,
    sound: SoundRef,
    enabled: bool,
    #[serde(deserialize_with = "deserialize_unique_map")]
    parameters: BTreeMap<String, ParameterValue>,
}

impl VoiceSettings {
    /// Constructs voice settings with no material and no custom parameters.
    #[must_use]
    pub fn new(name: impl Into<String>, sound: SoundRef) -> Self {
        Self {
            name: name.into(),
            pattern: None,
            sound,
            enabled: true,
            parameters: BTreeMap::new(),
        }
    }

    /// Associates the voice with one material source pattern.
    #[must_use]
    pub fn with_material(mut self, material: MaterialId) -> Self {
        self.pattern = Some(Pattern::material(material));
        self
    }

    /// Associates the voice with a composed pattern tree.
    #[must_use]
    pub fn with_pattern(mut self, pattern: Pattern) -> Self {
        self.pattern = Some(pattern);
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

    /// Returns referenced material when the voice uses one direct material pattern.
    #[must_use]
    pub const fn material(&self) -> Option<MaterialId> {
        match &self.pattern {
            Some(Pattern::Material { material_id }) => Some(*material_id),
            _ => None,
        }
    }

    /// Returns the voice's pattern tree when present.
    #[must_use]
    pub const fn pattern(&self) -> Option<&Pattern> {
        self.pattern.as_ref()
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
    #[serde(deserialize_with = "deserialize_unique_map")]
    materials: BTreeMap<MaterialId, Material>,
    #[serde(deserialize_with = "deserialize_unique_map")]
    voices: BTreeMap<VoiceId, Voice>,
    #[serde(deserialize_with = "deserialize_unique_map")]
    macros: BTreeMap<MacroId, Macro>,
    #[serde(deserialize_with = "deserialize_unique_map")]
    purpose_presets: BTreeMap<PurposePresetId, PurposePreset>,
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
            macros: BTreeMap::new(),
            purpose_presets: BTreeMap::new(),
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

    /// Returns composer-published macros in stable ID order.
    #[must_use]
    pub const fn macros(&self) -> &BTreeMap<MacroId, Macro> {
        &self.macros
    }

    /// Returns authored listener-purpose presets in stable ID order.
    #[must_use]
    pub const fn purpose_presets(&self) -> &BTreeMap<PurposePresetId, PurposePreset> {
        &self.purpose_presets
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
        let mut value = serde_json::from_str::<StrictValue>(input)?.0;
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
        if schema > SCHEMA_VERSION {
            return Err(LoadError::UnsupportedSchema {
                found: schema,
                supported: SCHEMA_VERSION,
            });
        }
        let document: Self = if schema == SCHEMA_VERSION {
            serde_json::from_str(input)?
        } else {
            for version in schema..SCHEMA_VERSION {
                value = match version {
                    1 => migrate_v1_to_v2(value)?,
                    2 => migrate_v2_to_v3(value)?,
                    _ => {
                        return Err(MigrationError::UnsupportedSource(version).into());
                    }
                };
            }
            serde_json::from_value(value)?
        };
        let diagnostics = document.validate();
        if diagnostics
            .iter()
            .any(|item| item.severity == Severity::Error)
        {
            return Err(LoadError::InvalidDocument(diagnostics));
        }
        Ok(document)
    }

    /// Queries every enabled voice for events overlapping one half-open time span.
    ///
    /// Events use this document's persisted root seed and are sorted and deduplicated.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError`] when a pattern cannot be evaluated.
    pub fn query_events(&self, span: TimeSpan) -> Result<Vec<Event>, PatternError> {
        self.query_events_with_seed(span, self.seed)
    }

    /// Queries every enabled voice with an explicit realization seed.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError`] when a pattern cannot be evaluated.
    pub fn query_events_with_seed(
        &self,
        span: TimeSpan,
        seed: Seed,
    ) -> Result<Vec<Event>, PatternError> {
        let mut events = Vec::new();
        for voice in self.piece.voices.values() {
            if !voice.settings.enabled {
                continue;
            }
            if let Some(pattern) = self.resolved_pattern(voice) {
                events.extend(pattern.query(self, voice.id, span, seed)?);
            }
        }
        events.sort_by(|left, right| {
            left.span()
                .start()
                .cmp(&right.span().start())
                .then(left.span().end().cmp(&right.span().end()))
                .then(left.target().cmp(right.target()))
                .then(left.source().cmp(right.source()))
                .then(left.kind().cmp(right.kind()))
                .then(left.properties().cmp(right.properties()))
        });
        events.dedup();
        Ok(events)
    }

    /// Resolves a voice's authored parameters through all published macro mappings.
    #[must_use]
    pub fn resolved_voice_parameters(
        &self,
        voice_id: VoiceId,
    ) -> Option<BTreeMap<String, ParameterValue>> {
        let voice = self.piece.voices.get(&voice_id)?;
        let mut parameters = voice.settings.parameters.clone();
        for published in self.piece.macros.values() {
            for mapping in &published.mappings {
                if let MacroMapping::VoiceParameter {
                    voice_id: target,
                    parameter,
                    minimum,
                    maximum,
                } = mapping
                    && *target == voice_id
                {
                    parameters.insert(
                        parameter.clone(),
                        ParameterValue::Integer(published.value.interpolate(*minimum, *maximum)),
                    );
                }
            }
        }
        Some(parameters)
    }

    fn resolved_pattern(&self, voice: &Voice) -> Option<Pattern> {
        let mut pattern = voice.settings.pattern.clone()?;
        for published in self.piece.macros.values() {
            for mapping in &published.mappings {
                if let MacroMapping::ProcessProbability {
                    pattern_id,
                    minimum,
                    maximum,
                } = mapping
                {
                    let percentage = published
                        .value
                        .interpolate(i64::from(minimum.value()), i64::from(maximum.value()));
                    let probability =
                        Probability::new(u32::try_from(percentage).ok()?, 100).ok()?;
                    pattern.set_process_probability(*pattern_id, probability);
                }
            }
        }
        Some(pattern)
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
        validate_macros(&self.piece, &mut diagnostics);
        validate_purpose_presets(&self.piece, &mut diagnostics);
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
            Operation::SetTempo(tempo) => self.piece.transport.tempo = tempo,
            Operation::AddMacro(published) => {
                let id = published.id;
                if self.piece.macros.insert(id, published).is_some() {
                    return Err(OperationError::AlreadyExists {
                        entity: "macro",
                        id: id.to_string(),
                    });
                }
            }
            Operation::RemoveMacro(id) => {
                self.piece
                    .macros
                    .remove(&id)
                    .ok_or_else(|| OperationError::NotFound {
                        entity: "macro",
                        id: id.to_string(),
                    })?;
            }
            Operation::SetMacroValue { id, value } => {
                let published =
                    self.piece
                        .macros
                        .get_mut(&id)
                        .ok_or_else(|| OperationError::NotFound {
                            entity: "macro",
                            id: id.to_string(),
                        })?;
                published.value = value;
            }
            Operation::AddPurposePreset(preset) => {
                let id = preset.id;
                if self.piece.purpose_presets.insert(id, preset).is_some() {
                    return Err(OperationError::AlreadyExists {
                        entity: "purpose preset",
                        id: id.to_string(),
                    });
                }
            }
            Operation::RemovePurposePreset(id) => {
                self.piece
                    .purpose_presets
                    .remove(&id)
                    .ok_or_else(|| OperationError::NotFound {
                        entity: "purpose preset",
                        id: id.to_string(),
                    })?;
            }
            Operation::ApplyPurposePreset(id) => {
                let values = self
                    .piece
                    .purpose_presets
                    .get(&id)
                    .ok_or_else(|| OperationError::NotFound {
                        entity: "purpose preset",
                        id: id.to_string(),
                    })?
                    .macro_values
                    .clone();
                for (macro_id, value) in values {
                    let published = self.piece.macros.get_mut(&macro_id).ok_or_else(|| {
                        OperationError::NotFound {
                            entity: "macro",
                            id: macro_id.to_string(),
                        }
                    })?;
                    published.value = value;
                }
            }
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
                let pattern = self.step_pattern_mut(material_id)?;
                let cell = pattern
                    .rows
                    .get_mut(row)
                    .and_then(|pattern_row| pattern_row.cells.get_mut(step))
                    .ok_or(OperationError::CellOutOfBounds { row, step })?;
                cell.active = active;
            }
            Operation::ConfigureStepPattern {
                material_id,
                steps,
                subdivision,
                pitches,
            } => self
                .step_pattern_mut(material_id)?
                .reconfigure(steps, subdivision, pitches)?,
            Operation::QuantizePhrase { material_id, grid } => {
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
                quantize_phrase(phrase, grid)?;
            }
        }
        Ok(())
    }

    fn step_pattern_mut(
        &mut self,
        material_id: MaterialId,
    ) -> Result<&mut StepPattern, OperationError> {
        let material =
            self.piece
                .materials
                .get_mut(&material_id)
                .ok_or_else(|| OperationError::NotFound {
                    entity: "material",
                    id: material_id.to_string(),
                })?;
        let Material::StepPattern { pattern, .. } = material else {
            return Err(OperationError::WrongMaterialKind {
                id: material_id.to_string(),
                expected: "step_pattern",
            });
        };
        Ok(pattern)
    }
}

/// A bounded semantic change to a document.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", content = "payload", rename_all = "snake_case")]
pub enum Operation {
    /// Replaces document metadata.
    SetMetadata(Metadata),
    /// Changes the root composition seed.
    SetSeed(Seed),
    /// Changes the constant metric tempo while preserving the meter.
    SetTempo(Tempo),
    /// Publishes a composer-authored high-level control.
    AddMacro(Macro),
    /// Removes a published macro that no purpose preset references.
    RemoveMacro(MacroId),
    /// Changes one published macro's normalized position.
    SetMacroValue {
        /// Target macro.
        id: MacroId,
        /// New normalized position.
        value: MacroValue,
    },
    /// Adds an authored listener-purpose preset.
    AddPurposePreset(PurposePreset),
    /// Removes an authored listener-purpose preset.
    RemovePurposePreset(PurposePresetId),
    /// Applies every macro value stored in one purpose preset.
    ApplyPurposePreset(PurposePresetId),
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
    /// Changes step count, subdivision, and row pitches while retaining overlapping cells.
    ConfigureStepPattern {
        /// Target step-pattern material.
        material_id: MaterialId,
        /// New positive step count.
        steps: usize,
        /// New positive duration for each step in quarter-note beats.
        subdivision: Beats,
        /// Pitch rows in display order.
        pitches: Vec<Pitch>,
    },
    /// Quantizes phrase notes that use the grid's clock domain.
    QuantizePhrase {
        /// Target phrase material.
        material_id: MaterialId,
        /// Metric or absolute-time quantization grid.
        grid: QuantizationGrid,
    },
}

/// An exact metric or absolute-time grid used to quantize phrase notes.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "clock", content = "value", rename_all = "snake_case")]
pub enum QuantizationGrid {
    /// A grid measured in quarter-note beats.
    Metric(Beats),
    /// A grid measured in elapsed seconds.
    Absolute(AbsoluteDuration),
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
    /// A requested document value was outside its permitted range.
    #[error("invalid document value: {0}")]
    Value(#[from] DocumentValueError),
    /// Exact time arithmetic failed while applying a transformation.
    #[error("could not transform note timing: {0}")]
    Time(#[from] TimeError),
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

/// A deterministic schema migration failure.
#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum MigrationError {
    /// A migration received a JSON shape that the source schema does not permit.
    #[error("schema migration could not find {0}")]
    MissingField(&'static str),
    /// No sequential migration exists for the source schema.
    #[error("no migration is available from schema {0}")]
    UnsupportedSource(u32),
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
    /// A supported older schema could not be migrated.
    #[error("could not migrate document: {0}")]
    Migration(#[from] MigrationError),
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
    fn warning(
        code: DiagnosticCode,
        location: Option<DiagnosticLocation>,
        message: impl Into<String>,
        help: Option<String>,
    ) -> Self {
        Self {
            code,
            severity: Severity::Warning,
            message: message.into(),
            location,
            help,
        }
    }

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

struct StrictValue(serde_json::Value);

impl<'de> Deserialize<'de> for StrictValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct StrictValueVisitor;

        impl<'de> Visitor<'de> for StrictValueVisitor {
            type Value = StrictValue;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a JSON value without duplicate object keys")
            }

            fn visit_bool<E>(self, value: bool) -> Result<Self::Value, E> {
                Ok(StrictValue(serde_json::Value::Bool(value)))
            }

            fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E> {
                Ok(StrictValue(serde_json::Value::from(value)))
            }

            fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E> {
                Ok(StrictValue(serde_json::Value::from(value)))
            }

            fn visit_f64<E>(self, value: f64) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                serde_json::Number::from_f64(value)
                    .map(serde_json::Value::Number)
                    .map(StrictValue)
                    .ok_or_else(|| de::Error::custom("JSON number must be finite"))
            }

            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E> {
                Ok(StrictValue(serde_json::Value::String(value.to_owned())))
            }

            fn visit_string<E>(self, value: String) -> Result<Self::Value, E> {
                Ok(StrictValue(serde_json::Value::String(value)))
            }

            fn visit_none<E>(self) -> Result<Self::Value, E> {
                Ok(StrictValue(serde_json::Value::Null))
            }

            fn visit_unit<E>(self) -> Result<Self::Value, E> {
                Ok(StrictValue(serde_json::Value::Null))
            }

            fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
            where
                D: Deserializer<'de>,
            {
                StrictValue::deserialize(deserializer)
            }

            fn visit_seq<A>(self, mut sequence: A) -> Result<Self::Value, A::Error>
            where
                A: SeqAccess<'de>,
            {
                let mut values = Vec::new();
                while let Some(value) = sequence.next_element::<StrictValue>()? {
                    values.push(value.0);
                }
                Ok(StrictValue(serde_json::Value::Array(values)))
            }

            fn visit_map<A>(self, mut access: A) -> Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let mut values = serde_json::Map::new();
                while let Some((key, value)) = access.next_entry::<String, StrictValue>()? {
                    if values.insert(key, value.0).is_some() {
                        return Err(de::Error::custom("duplicate object key"));
                    }
                }
                Ok(StrictValue(serde_json::Value::Object(values)))
            }
        }

        deserializer.deserialize_any(StrictValueVisitor)
    }
}

fn migrate_v1_to_v2(mut value: serde_json::Value) -> Result<serde_json::Value, MigrationError> {
    let root = value
        .as_object_mut()
        .ok_or(MigrationError::MissingField("document root"))?;
    let piece = root
        .get_mut("piece")
        .and_then(serde_json::Value::as_object_mut)
        .ok_or(MigrationError::MissingField("piece"))?;
    let voices = piece
        .get_mut("voices")
        .and_then(serde_json::Value::as_object_mut)
        .ok_or(MigrationError::MissingField("piece.voices"))?;
    for voice in voices.values_mut() {
        let settings = voice
            .get_mut("settings")
            .and_then(serde_json::Value::as_object_mut)
            .ok_or(MigrationError::MissingField("voice.settings"))?;
        let material = settings
            .remove("material")
            .ok_or(MigrationError::MissingField("voice.settings.material"))?;
        let pattern = if material.is_null() {
            serde_json::Value::Null
        } else {
            let mut pattern = serde_json::Map::new();
            pattern.insert(
                "type".to_owned(),
                serde_json::Value::String("material".to_owned()),
            );
            pattern.insert("material_id".to_owned(), material);
            serde_json::Value::Object(pattern)
        };
        settings.insert("pattern".to_owned(), pattern);
    }
    root.insert("schema_version".to_owned(), serde_json::Value::from(2));
    Ok(value)
}

fn migrate_v2_to_v3(mut value: serde_json::Value) -> Result<serde_json::Value, MigrationError> {
    let root = value
        .as_object_mut()
        .ok_or(MigrationError::MissingField("document root"))?;
    let piece = root
        .get_mut("piece")
        .and_then(serde_json::Value::as_object_mut)
        .ok_or(MigrationError::MissingField("piece"))?;
    piece.insert(
        "macros".to_owned(),
        serde_json::Value::Object(serde_json::Map::new()),
    );
    piece.insert(
        "purpose_presets".to_owned(),
        serde_json::Value::Object(serde_json::Map::new()),
    );
    root.insert(
        "schema_version".to_owned(),
        serde_json::Value::from(SCHEMA_VERSION),
    );
    Ok(value)
}

fn deserialize_unique_map<'de, D, K, V>(deserializer: D) -> Result<BTreeMap<K, V>, D::Error>
where
    D: Deserializer<'de>,
    K: Deserialize<'de> + Ord,
    V: Deserialize<'de>,
{
    struct UniqueMapVisitor<K, V>(PhantomData<(K, V)>);

    impl<'de, K, V> Visitor<'de> for UniqueMapVisitor<K, V>
    where
        K: Deserialize<'de> + Ord,
        V: Deserialize<'de>,
    {
        type Value = BTreeMap<K, V>;

        fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("an object with unique keys")
        }

        fn visit_map<A>(self, mut access: A) -> Result<Self::Value, A::Error>
        where
            A: MapAccess<'de>,
        {
            let mut values = BTreeMap::new();
            while let Some((key, value)) = access.next_entry()? {
                if values.insert(key, value).is_some() {
                    return Err(de::Error::custom("duplicate object key"));
                }
            }
            Ok(values)
        }
    }

    deserializer.deserialize_map(UniqueMapVisitor(PhantomData))
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
                        Some(
                            "use a non-negative onset and a duration greater than zero".to_owned(),
                        ),
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
                        Some("set velocity to an integer from 1 through 127".to_owned()),
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
                    Some(
                        "add a pitch row and step, then use a subdivision greater than zero"
                            .to_owned(),
                    ),
                ));
            }
            for row in &pattern.rows {
                if row.cells.len() != pattern.steps {
                    diagnostics.push(Diagnostic::error(
                        DiagnosticCode::PatternInvalid,
                        location("rows"),
                        "every step-pattern row must match the declared step count",
                        Some(
                            "make each row contain exactly the declared number of cells".to_owned(),
                        ),
                    ));
                }
            }
        }
        Material::PitchSet { .. } => {}
    }
}

fn quantize_phrase(phrase: &mut Phrase, grid: QuantizationGrid) -> Result<(), TimeError> {
    match grid {
        QuantizationGrid::Metric(subdivision) if !subdivision.is_positive() => {
            return Err(TimeError::OutOfRange(
                "metric quantization subdivision must be positive",
            ));
        }
        QuantizationGrid::Absolute(subdivision) if subdivision.is_zero() => {
            return Err(TimeError::OutOfRange(
                "absolute quantization subdivision must be positive",
            ));
        }
        QuantizationGrid::Metric(_) | QuantizationGrid::Absolute(_) => {}
    }

    for note in phrase.notes.values_mut() {
        match (&mut note.time, grid) {
            (NoteTime::Metric { onset, duration }, QuantizationGrid::Metric(subdivision)) => {
                *onset = onset.quantize(subdivision)?;
                *duration = duration.quantize(subdivision)?;
                if !duration.is_positive() {
                    *duration = subdivision;
                }
            }
            (NoteTime::Absolute { onset, duration }, QuantizationGrid::Absolute(subdivision)) => {
                *onset = onset.quantize(subdivision)?;
                *duration = duration.quantize(subdivision)?;
                if duration.is_zero() {
                    *duration = subdivision;
                }
            }
            (NoteTime::Metric { .. }, QuantizationGrid::Absolute(_))
            | (NoteTime::Absolute { .. }, QuantizationGrid::Metric(_)) => {}
        }
    }
    Ok(())
}

#[allow(clippy::too_many_lines)]
fn validate_macros(piece: &Piece, diagnostics: &mut Vec<Diagnostic>) {
    let mut targets = BTreeMap::<String, MacroId>::new();
    for (id, published) in &piece.macros {
        let location = |field: &str| {
            Some(DiagnosticLocation::new(
                id.to_string(),
                Some(field.to_owned()),
            ))
        };
        if *id != published.id {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::IdentityMismatch,
                Some(DiagnosticLocation::new(id.to_string(), None)),
                "macro map key does not match the macro ID",
                None,
            ));
        }
        if published.name.trim().is_empty() {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::ValueEmpty,
                location("name"),
                "macro name must not be empty",
                Some("provide a listener-facing macro name".to_owned()),
            ));
        }
        if published.mappings.is_empty() {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::ReferenceMissing,
                location("mappings"),
                "a published macro must control at least one value",
                Some("add a voice parameter or process probability mapping".to_owned()),
            ));
        }
        for mapping in &published.mappings {
            let target = match mapping {
                MacroMapping::VoiceParameter {
                    voice_id,
                    parameter,
                    minimum,
                    maximum,
                } => {
                    if !piece.voices.contains_key(voice_id) {
                        diagnostics.push(Diagnostic::error(
                            DiagnosticCode::ReferenceMissing,
                            location("mappings"),
                            format!("mapped voice `{voice_id}` does not exist"),
                            None,
                        ));
                    }
                    if parameter.trim().is_empty() {
                        diagnostics.push(Diagnostic::error(
                            DiagnosticCode::ValueEmpty,
                            location("mappings"),
                            "mapped parameter name must not be empty",
                            None,
                        ));
                    }
                    if minimum == maximum {
                        diagnostics.push(Diagnostic::warning(
                            DiagnosticCode::RangeInvalid,
                            location("mappings"),
                            "macro mapping has no audible range",
                            Some("use different minimum and maximum values".to_owned()),
                        ));
                    }
                    format!("voice:{voice_id}:{parameter}")
                }
                MacroMapping::ProcessProbability { pattern_id, .. } => {
                    let occurrences = piece
                        .voices
                        .values()
                        .filter_map(|voice| voice.settings.pattern.as_ref())
                        .map(|pattern| pattern.process_occurrences(*pattern_id))
                        .sum::<usize>();
                    match occurrences {
                        0 => diagnostics.push(Diagnostic::error(
                            DiagnosticCode::ReferenceMissing,
                            location("mappings"),
                            format!("mapped process `{pattern_id}` does not exist"),
                            None,
                        )),
                        1 => {}
                        _ => diagnostics.push(Diagnostic::error(
                            DiagnosticCode::IdentityMismatch,
                            location("mappings"),
                            format!("mapped process ID `{pattern_id}` occurs more than once"),
                            Some("give every mapped stochastic process a unique ID".to_owned()),
                        )),
                    }
                    format!("process:{pattern_id}:probability")
                }
            };
            if let Some(previous) = targets.insert(target.clone(), *id) {
                diagnostics.push(Diagnostic::error(
                    DiagnosticCode::IdentityMismatch,
                    location("mappings"),
                    format!(
                        "mapping target `{target}` is already controlled by macro `{previous}`"
                    ),
                    Some("publish each underlying value from only one macro".to_owned()),
                ));
            }
        }
    }
}

fn validate_purpose_presets(piece: &Piece, diagnostics: &mut Vec<Diagnostic>) {
    for (id, preset) in &piece.purpose_presets {
        let location = |field: &str| {
            Some(DiagnosticLocation::new(
                id.to_string(),
                Some(field.to_owned()),
            ))
        };
        if *id != preset.id {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::IdentityMismatch,
                Some(DiagnosticLocation::new(id.to_string(), None)),
                "purpose preset map key does not match the preset ID",
                None,
            ));
        }
        if preset.name.trim().is_empty() {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::ValueEmpty,
                location("name"),
                "purpose preset name must not be empty",
                Some("provide a listener-facing preset name".to_owned()),
            ));
        }
        if preset.macro_values.is_empty() {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::ReferenceMissing,
                location("macro_values"),
                "purpose preset must set at least one published macro",
                None,
            ));
        }
        for macro_id in preset.macro_values.keys() {
            if !piece.macros.contains_key(macro_id) {
                diagnostics.push(Diagnostic::error(
                    DiagnosticCode::ReferenceMissing,
                    location("macro_values"),
                    format!("preset macro `{macro_id}` does not exist"),
                    None,
                ));
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
    if let Some(pattern) = &voice.settings.pattern {
        let mut structure_errors = Vec::new();
        pattern.validate_structure(&mut structure_errors);
        for message in structure_errors {
            diagnostics.push(Diagnostic::error(
                DiagnosticCode::PatternInvalid,
                location("pattern"),
                message,
                Some("add a valid child pattern or remove the empty operator".to_owned()),
            ));
        }

        let mut material_ids = Vec::new();
        pattern.material_ids(&mut material_ids);
        material_ids.sort_unstable();
        material_ids.dedup();
        for material in material_ids {
            if !materials.contains_key(&material) {
                diagnostics.push(Diagnostic::error(
                    DiagnosticCode::ReferenceMissing,
                    location("pattern"),
                    format!("referenced material `{material}` does not exist"),
                    Some("add the material or choose an existing material".to_owned()),
                ));
            }
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
        assert!(json.contains("\"schema_version\": 3"));
        assert!(json.contains("\"seed\": \"000000000000002a\""));
        let loaded = Document::from_json(&json).unwrap();
        assert_eq!(loaded, document);
        assert_eq!(loaded.to_json().unwrap(), json);
    }

    #[test]
    fn version_one_voice_materials_migrate_to_source_patterns() {
        let mut document = fixture();
        let material_id = id("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        let voice_id = id("826b8913-4c23-43e1-b150-594737909a58");
        document
            .apply(Operation::AddMaterial(Material::phrase(
                material_id,
                "Phrase",
                Phrase::new(),
            )))
            .unwrap();
        document
            .apply(Operation::AddVoice(Voice::new(
                voice_id,
                VoiceSettings::new("Piano", SoundRef::new("felt-piano").unwrap())
                    .with_material(material_id),
            )))
            .unwrap();

        let mut old: serde_json::Value =
            serde_json::from_str(&document.to_json().unwrap()).unwrap();
        old["schema_version"] = serde_json::Value::from(1);
        let settings = old["piece"]["voices"][voice_id.to_string()]["settings"]
            .as_object_mut()
            .unwrap();
        settings.remove("pattern");
        settings.insert(
            "material".to_owned(),
            serde_json::Value::String(material_id.to_string()),
        );

        let loaded = Document::from_json(&serde_json::to_string(&old).unwrap()).unwrap();
        assert_eq!(loaded.schema_version(), SCHEMA_VERSION);
        assert_eq!(
            loaded.piece().voices()[&voice_id].settings().material(),
            Some(material_id)
        );
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
    fn loading_rejects_invalid_material_payloads() {
        let mut document = fixture();
        let material_id = id("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        document
            .apply(Operation::AddMaterial(Material::phrase(
                material_id,
                "Phrase",
                Phrase::new(),
            )))
            .unwrap();
        let json = document.to_json().unwrap();
        let unknown = json.replace("\"phrase\": {", "\"unknown\": true,\n        \"phrase\": {");
        assert!(matches!(
            Document::from_json(&unknown),
            Err(LoadError::Json(_))
        ));
    }

    #[test]
    fn loading_reports_malformed_pattern_trees() {
        let mut document = fixture();
        let voice_id = id("826b8913-4c23-43e1-b150-594737909a58");
        document
            .apply(Operation::AddVoice(Voice::new(
                voice_id,
                VoiceSettings::new("Piano", SoundRef::new("felt-piano").unwrap())
                    .with_pattern(Pattern::sequence([])),
            )))
            .unwrap_err();

        let mut value: serde_json::Value =
            serde_json::from_str(&fixture().to_json().unwrap()).unwrap();
        value["piece"]["voices"] = serde_json::json!({
            voice_id.to_string(): {
                "id": voice_id,
                "settings": {
                    "name": "Piano",
                    "pattern": { "type": "sequence", "patterns": [] },
                    "sound": "felt-piano",
                    "enabled": true,
                    "parameters": {}
                }
            }
        });
        let error = Document::from_json(&serde_json::to_string(&value).unwrap()).unwrap_err();
        let LoadError::InvalidDocument(diagnostics) = error else {
            panic!("expected semantic validation failure");
        };
        assert!(diagnostics.iter().any(|diagnostic| {
            diagnostic.code() == DiagnosticCode::PatternInvalid
                && diagnostic.message().contains("at least one child")
        }));
    }

    #[test]
    fn loading_rejects_duplicate_entity_ids() {
        let mut document = fixture();
        let material_id = id("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        document
            .apply(Operation::AddMaterial(Material::phrase(
                material_id,
                "Phrase",
                Phrase::new(),
            )))
            .unwrap();
        let mut json = document.to_json().unwrap();
        let materials_start = json.find("\"materials\": {\n").unwrap() + "\"materials\": {\n".len();
        let materials_end = json[materials_start..]
            .find("\n    },\n    \"voices\"")
            .unwrap()
            + materials_start;
        let entry = json[materials_start..materials_end].to_owned();
        json.replace_range(
            materials_start..materials_end,
            &format!("{entry},\n{entry}"),
        );

        assert!(matches!(
            Document::from_json(&json),
            Err(LoadError::Json(_))
        ));
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
                VoiceSettings::new("Piano", sound)
                    .with_material(phrase_id)
                    .with_parameter("muted", ParameterValue::Boolean(false)),
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
        assert!(step_pattern(&document, matrix_id).rows()[1].cells()[3].active());
        let json = document.to_json().unwrap();
        assert!(json.contains("\"type\": \"phrase\""));
        assert!(json.contains("\"type\": \"step_pattern\""));
        assert_eq!(Document::from_json(&json).unwrap(), document);

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
    fn macros_resolve_multiple_values_and_purpose_presets_atomically() {
        let mut document = fixture();
        let material_id = id("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        let voice_id = id("826b8913-4c23-43e1-b150-594737909a58");
        let process_id = id("57e45f20-e8a4-40fb-b115-4f3cb0963aa0");
        let macro_id = id("4a5ff1e6-0995-4c50-a774-41246cabcacf");
        let preset_id = id("75bb83d3-5aa1-491f-a865-4bdd4f17c169");
        document
            .apply(Operation::AddMaterial(Material::phrase(
                material_id,
                "Phrase",
                Phrase::new(),
            )))
            .unwrap();
        document
            .apply(Operation::AddVoice(Voice::new(
                voice_id,
                VoiceSettings::new("Piano", SoundRef::new("felt-piano").unwrap())
                    .with_pattern(
                        Pattern::material(material_id)
                            .omit(process_id, Probability::new(1, 10).unwrap()),
                    )
                    .with_parameter("gain", ParameterValue::Integer(20)),
            )))
            .unwrap();
        document
            .apply(Operation::AddMacro(
                Macro::new(
                    macro_id,
                    "Intensity",
                    MacroSemantic::Intensity,
                    MacroValue::new(25).unwrap(),
                )
                .with_mapping(MacroMapping::VoiceParameter {
                    voice_id,
                    parameter: "gain".to_owned(),
                    minimum: 20,
                    maximum: 80,
                })
                .with_mapping(MacroMapping::ProcessProbability {
                    pattern_id: process_id,
                    minimum: MacroValue::new(50).unwrap(),
                    maximum: MacroValue::new(0).unwrap(),
                }),
            ))
            .unwrap();
        document
            .apply(Operation::AddPurposePreset(
                PurposePreset::new(preset_id, "Create", Purpose::Create)
                    .with_macro(macro_id, MacroValue::new(75).unwrap()),
            ))
            .unwrap();

        assert_eq!(
            document.resolved_voice_parameters(voice_id).unwrap()["gain"],
            ParameterValue::Integer(35)
        );
        let voice = &document.piece.voices[&voice_id];
        let resolved = document.resolved_pattern(voice).unwrap();
        assert!(
            serde_json::to_string(&resolved)
                .unwrap()
                .contains("\"probability\":{\"numerator\":37,\"denominator\":100}")
        );

        document
            .apply(Operation::ApplyPurposePreset(preset_id))
            .unwrap();
        assert_eq!(
            document.piece.macros[&macro_id].value(),
            MacroValue::new(75).unwrap()
        );
        assert_eq!(
            document.resolved_voice_parameters(voice_id).unwrap()["gain"],
            ParameterValue::Integer(65)
        );
        assert_eq!(
            Document::from_json(&document.to_json().unwrap()).unwrap(),
            document
        );
    }

    #[test]
    fn schema_two_documents_gain_empty_listener_controls() {
        let document = fixture();
        let mut old: serde_json::Value =
            serde_json::from_str(&document.to_json().unwrap()).unwrap();
        old["schema_version"] = serde_json::Value::from(2);
        old["piece"].as_object_mut().unwrap().remove("macros");
        old["piece"]
            .as_object_mut()
            .unwrap()
            .remove("purpose_presets");

        let loaded = Document::from_json(&serde_json::to_string(&old).unwrap()).unwrap();
        assert!(loaded.piece().macros().is_empty());
        assert!(loaded.piece().purpose_presets().is_empty());
    }

    fn step_pattern(document: &Document, material_id: MaterialId) -> &StepPattern {
        let Material::StepPattern { pattern, .. } =
            document.piece().materials().get(&material_id).unwrap()
        else {
            panic!("fixture material must be a step pattern");
        };
        pattern
    }

    #[test]
    fn step_pattern_configuration_preserves_overlapping_cells() {
        let mut document = fixture();
        let matrix_id = id("313b2f8d-8c00-4d82-82f6-cdb7aeb112de");
        let mut pattern = StepPattern::new(
            4,
            Beats::new(1, 4).unwrap(),
            [Pitch::from_semitones(48), Pitch::from_semitones(55)],
        )
        .unwrap();
        pattern.rows[1].cells[3].active = true;
        document
            .apply(Operation::AddMaterial(Material::step_pattern(
                matrix_id, "Matrix", pattern,
            )))
            .unwrap();

        document
            .apply(Operation::ConfigureStepPattern {
                material_id: matrix_id,
                steps: 6,
                subdivision: Beats::new(1, 2).unwrap(),
                pitches: vec![Pitch::from_semitones(50), Pitch::from_semitones(57)],
            })
            .unwrap();

        let configured = step_pattern(&document, matrix_id);
        assert_eq!(configured.steps(), 6);
        assert_eq!(configured.subdivision(), Beats::new(1, 2).unwrap());
        assert_eq!(configured.rows()[0].pitch(), Pitch::from_semitones(50));
        assert!(configured.rows()[1].cells()[3].active());
    }

    #[test]
    fn quantization_edits_each_clock_domain_without_discarding_recorded_timing() {
        let mut document = fixture();
        let phrase_id = id("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        document
            .apply(Operation::AddMaterial(Material::phrase(
                phrase_id,
                "Recorded phrase",
                Phrase::new(),
            )))
            .unwrap();
        let absolute_note_id = id("92b8d664-2b27-45ca-a7c2-f816124fe813");
        document
            .apply(Operation::InsertNote {
                material_id: phrase_id,
                note: Note::new(
                    absolute_note_id,
                    Pitch::from_semitones(60),
                    NoteTime::Absolute {
                        onset: AbsoluteTime::new(13, 100).unwrap(),
                        duration: AbsoluteDuration::new(19, 100).unwrap(),
                    },
                    90,
                )
                .unwrap(),
            })
            .unwrap();
        let metric_note_id = id("152ef5b4-f493-43f8-91a2-dba94309922a");
        document
            .apply(Operation::InsertNote {
                material_id: phrase_id,
                note: Note::new(
                    metric_note_id,
                    Pitch::from_semitones(64),
                    NoteTime::Metric {
                        onset: Beats::new(1, 8).unwrap(),
                        duration: Beats::new(1, 8).unwrap(),
                    },
                    100,
                )
                .unwrap(),
            })
            .unwrap();

        document
            .apply(Operation::QuantizePhrase {
                material_id: phrase_id,
                grid: QuantizationGrid::Absolute(AbsoluteDuration::new(1, 10).unwrap()),
            })
            .unwrap();
        document
            .apply(Operation::QuantizePhrase {
                material_id: phrase_id,
                grid: QuantizationGrid::Metric(Beats::new(1, 4).unwrap()),
            })
            .unwrap();

        let Material::Phrase { phrase, .. } = document.piece().materials().get(&phrase_id).unwrap()
        else {
            panic!("fixture material must remain a phrase");
        };
        assert_eq!(
            absolute_note_time(phrase, absolute_note_id),
            ("1/10".to_owned(), "1/5".to_owned())
        );
        assert_eq!(
            metric_note_time(phrase, metric_note_id),
            ("1/4".to_owned(), "1/4".to_owned())
        );
    }

    fn absolute_note_time(phrase: &Phrase, note_id: NoteId) -> (String, String) {
        let NoteTime::Absolute { onset, duration } = phrase.notes()[&note_id].time() else {
            panic!("note must use absolute time");
        };
        (onset.to_string(), duration.to_string())
    }

    fn metric_note_time(phrase: &Phrase, note_id: NoteId) -> (String, String) {
        let NoteTime::Metric { onset, duration } = phrase.notes()[&note_id].time() else {
            panic!("note must use metric time");
        };
        (onset.to_string(), duration.to_string())
    }

    #[test]
    fn pitch_sets_are_materials_with_explicit_tags() {
        let mut document = fixture();
        let material_id = id("313b2f8d-8c00-4d82-82f6-cdb7aeb112de");
        document
            .apply(Operation::AddMaterial(Material::pitch_set(
                material_id,
                "Harmony",
                PitchSet::new([
                    Pitch::from_semitones(67),
                    Pitch::from_semitones(60),
                    Pitch::from_semitones(67),
                ]),
            )))
            .unwrap();
        let json = document.to_json().unwrap();
        assert!(json.contains("\"type\": \"pitch_set\""));
        assert_eq!(Document::from_json(&json).unwrap(), document);
    }

    #[test]
    fn transport_operations_update_seed_and_tempo() {
        let mut document = fixture();
        document.apply(Operation::SetSeed(Seed::new(7))).unwrap();
        document
            .apply(Operation::SetTempo(Tempo::new(96, 1).unwrap()))
            .unwrap();

        assert_eq!(document.seed(), Seed::new(7));
        assert_eq!(
            document.piece().transport().tempo(),
            Tempo::new(96, 1).unwrap()
        );
        assert_eq!(
            document.piece().transport().meter(),
            Some(Meter::new(4, 4).unwrap())
        );
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

    #[test]
    fn duplicate_material_ids_are_rejected_atomically() {
        let mut document = fixture();
        let material_id = id("313b2f8d-8c00-4d82-82f6-cdb7aeb112de");
        let material = Material::phrase(material_id, "Phrase", Phrase::new());
        document
            .apply(Operation::AddMaterial(material.clone()))
            .unwrap();
        let before = document.clone();
        assert!(matches!(
            document.apply(Operation::AddMaterial(material)),
            Err(OperationError::AlreadyExists {
                entity: "material",
                ..
            })
        ));
        assert_eq!(document, before);
    }
}
