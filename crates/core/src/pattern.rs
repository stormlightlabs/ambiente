//! Deterministic pattern queries and backend-independent events.

use std::{cmp::Ordering, collections::BTreeMap, fmt, str::FromStr};

use rand_chacha::ChaCha8Rng;
use rand_core::{RngCore, SeedableRng};
use serde::{Deserialize, Deserializer, Serialize, Serializer, de};
use thiserror::Error;
use uuid::{Uuid, Version};

use crate::{
    document::{Document, Material, MaterialId, NoteId, NoteTime, Seed, VoiceId},
    theory::{Interval, Pitch, TheoryError},
    time::{Beats, Rational, Seconds, TimeError},
};

const RANDOM_CONTEXT: &str = "ambiente-random-v1";

/// An error produced while constructing or querying a pattern.
#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum PatternError {
    /// A span mixed clock domains or did not have a positive length.
    #[error("a time span must use one clock domain and have an end after its start")]
    InvalidSpan,
    /// A scale factor was not positive.
    #[error("a time scale factor must be positive")]
    InvalidScale,
    /// A probability numerator exceeded its denominator or used a zero denominator.
    #[error("probability must have a positive denominator and lie between zero and one")]
    InvalidProbability,
    /// A weighted choice had no positive total weight.
    #[error("weighted choice requires at least one positive weight")]
    InvalidWeights,
    /// A pattern operation needed a finite, positive duration in one clock domain.
    #[error("{0} requires a finite, positive pattern duration in one clock domain")]
    DurationRequired(&'static str),
    /// A referenced material was absent.
    #[error("material `{0}` was not found")]
    MissingMaterial(MaterialId),
    /// Exact time arithmetic failed.
    #[error("pattern time arithmetic failed: {0}")]
    Time(#[from] TimeError),
    /// Pitch arithmetic failed.
    #[error("pattern pitch arithmetic failed: {0}")]
    Theory(#[from] TheoryError),
}

/// A stable identity for a stochastic pattern operator.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct PatternId(Uuid);

impl PatternId {
    /// Generates a new UUID version 4 identity.
    #[must_use]
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    /// Constructs an identity from a non-nil UUID version 4 value.
    ///
    /// # Errors
    ///
    /// Returns an error when the UUID is nil or is not version 4.
    pub fn from_uuid(value: Uuid) -> Result<Self, PatternIdError> {
        if value.is_nil() || value.get_version() != Some(Version::Random) {
            Err(PatternIdError)
        } else {
            Ok(Self(value))
        }
    }

    /// Returns the underlying UUID.
    #[must_use]
    pub const fn as_uuid(self) -> Uuid {
        self.0
    }
}

impl Default for PatternId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for PatternId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.hyphenated().fmt(formatter)
    }
}

impl FromStr for PatternId {
    type Err = PatternIdError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        Uuid::parse_str(value)
            .map_err(|_| PatternIdError)
            .and_then(Self::from_uuid)
    }
}

impl Serialize for PatternId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for PatternId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(de::Error::custom)
    }
}

/// An invalid stochastic pattern identity.
#[derive(Clone, Copy, Debug, Eq, Error, PartialEq)]
#[error("pattern IDs must be non-nil UUID version 4 values")]
pub struct PatternIdError;

/// One exact coordinate in metric or absolute time.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(tag = "clock", content = "value", rename_all = "snake_case")]
pub enum TimePoint {
    /// Quarter-note beats from the piece origin.
    Metric(Beats),
    /// Exact elapsed seconds from the piece origin.
    Absolute(Seconds),
}

impl TimePoint {
    fn scalar(self) -> (Clock, Rational) {
        match self {
            Self::Metric(value) => (Clock::Metric, value.0),
            Self::Absolute(value) => (Clock::Absolute, value.0),
        }
    }

    fn from_scalar(clock: Clock, value: Rational) -> Self {
        match clock {
            Clock::Metric => Self::Metric(Beats(value)),
            Clock::Absolute => Self::Absolute(Seconds(value)),
        }
    }
}

/// A half-open exact interval `[start, end)` in one clock domain.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TimeSpan {
    start: TimePoint,
    end: TimePoint,
}

impl TimeSpan {
    /// Constructs a non-empty half-open span in one clock domain.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError::InvalidSpan`] when the endpoints use different clocks or
    /// `end` is not after `start`.
    pub fn new(start: TimePoint, end: TimePoint) -> Result<Self, PatternError> {
        let (start_clock, start_value) = start.scalar();
        let (end_clock, end_value) = end.scalar();
        if start_clock != end_clock || end_value <= start_value {
            return Err(PatternError::InvalidSpan);
        }
        Ok(Self { start, end })
    }

    /// Constructs a metric span measured in quarter-note beats.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError::InvalidSpan`] when `end` is not after `start`.
    pub fn metric(start: Beats, end: Beats) -> Result<Self, PatternError> {
        Self::new(TimePoint::Metric(start), TimePoint::Metric(end))
    }

    /// Constructs an absolute span measured in exact elapsed seconds.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError::InvalidSpan`] when `end` is not after `start`.
    pub fn absolute(start: Seconds, end: Seconds) -> Result<Self, PatternError> {
        Self::new(TimePoint::Absolute(start), TimePoint::Absolute(end))
    }

    /// Returns the inclusive start coordinate.
    #[must_use]
    pub const fn start(self) -> TimePoint {
        self.start
    }

    /// Returns the exclusive end coordinate.
    #[must_use]
    pub const fn end(self) -> TimePoint {
        self.end
    }

    fn value(self) -> ScalarSpan {
        let (clock, start) = self.start.scalar();
        let (_, end) = self.end.scalar();
        ScalarSpan { clock, start, end }
    }
}

impl<'de> Deserialize<'de> for TimeSpan {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct WireSpan {
            start: TimePoint,
            end: TimePoint,
        }
        let value = WireSpan::deserialize(deserializer)?;
        Self::new(value.start, value.end).map_err(de::Error::custom)
    }
}

/// A signed metric or absolute displacement.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
#[serde(tag = "clock", content = "value", rename_all = "snake_case")]
pub enum TimeOffset {
    /// A displacement in quarter-note beats.
    Metric(Beats),
    /// A displacement in exact seconds.
    Absolute(Seconds),
}

impl TimeOffset {
    fn scalar(self) -> (Clock, Rational) {
        match self {
            Self::Metric(value) => (Clock::Metric, value.0),
            Self::Absolute(value) => (Clock::Absolute, value.0),
        }
    }
}

/// A positive exact factor used to stretch pattern time.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct TimeScale(Rational);

impl TimeScale {
    /// Constructs a positive exact scale factor.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError::InvalidScale`] when the value is not positive.
    pub fn new(numerator: i64, denominator: i64) -> Result<Self, PatternError> {
        let value = Rational::new(numerator, denominator)?;
        if value.is_positive() {
            Ok(Self(value))
        } else {
            Err(PatternError::InvalidScale)
        }
    }

    /// Returns the reduced numerator.
    #[must_use]
    pub fn numerator(self) -> i64 {
        self.0.numerator()
    }

    /// Returns the positive denominator.
    #[must_use]
    pub fn denominator(self) -> i64 {
        self.0.denominator()
    }
}

impl<'de> Deserialize<'de> for TimeScale {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        let rational = value.parse::<Beats>().map_err(de::Error::custom)?.0;
        if !rational.is_positive() {
            return Err(de::Error::custom("time scale must be positive"));
        }
        Ok(Self(rational))
    }
}

impl fmt::Display for TimeScale {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

impl Serialize for TimeScale {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// An exact probability in the inclusive range zero through one.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Probability {
    numerator: u32,
    denominator: u32,
}

impl Probability {
    /// Constructs an exact probability.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError::InvalidProbability`] for a zero denominator or a value
    /// greater than one.
    pub fn new(numerator: u32, denominator: u32) -> Result<Self, PatternError> {
        if denominator == 0 || numerator > denominator {
            return Err(PatternError::InvalidProbability);
        }
        let divisor = gcd_u32(numerator, denominator);
        Ok(Self {
            numerator: numerator / divisor,
            denominator: denominator / divisor,
        })
    }

    /// Returns the numerator.
    #[must_use]
    pub const fn numerator(self) -> u32 {
        self.numerator
    }

    /// Returns the denominator.
    #[must_use]
    pub const fn denominator(self) -> u32 {
        self.denominator
    }
}

fn gcd_u32(mut left: u32, mut right: u32) -> u32 {
    while right != 0 {
        (left, right) = (right, left % right);
    }
    left.max(1)
}

impl<'de> Deserialize<'de> for Probability {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct WireProbability {
            numerator: u32,
            denominator: u32,
        }
        let value = WireProbability::deserialize(deserializer)?;
        let probability =
            Self::new(value.numerator, value.denominator).map_err(de::Error::custom)?;
        if probability.numerator != value.numerator || probability.denominator != value.denominator
        {
            return Err(de::Error::custom("probability must be reduced"));
        }
        Ok(probability)
    }
}

/// A deterministic transformation that can also be applied conditionally.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Transformation {
    /// Moves events by a signed offset in the matching clock.
    Shift { offset: TimeOffset },
    /// Multiplies event positions and durations by a positive exact factor.
    Stretch { factor: TimeScale },
    /// Wraps event starts by an offset within the pattern duration.
    Rotate { offset: TimeOffset },
    /// Mirrors event spans within the pattern duration.
    Reverse,
    /// Transposes note pitches by a chromatic interval.
    Transpose { interval: Interval },
}

/// One branch and its integral selection weight.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WeightedPattern {
    weight: u32,
    pattern: Pattern,
}

impl WeightedPattern {
    /// Constructs a weighted branch. A zero weight makes the branch unreachable.
    #[must_use]
    pub const fn new(weight: u32, pattern: Pattern) -> Self {
        Self { weight, pattern }
    }

    /// Returns the branch weight.
    #[must_use]
    pub const fn weight(&self) -> u32 {
        self.weight
    }

    /// Returns the branch pattern.
    #[must_use]
    pub const fn pattern(&self) -> &Pattern {
        &self.pattern
    }
}

/// A composable deterministic pattern tree.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Pattern {
    /// Events read from authored material.
    Material { material_id: MaterialId },
    /// Child patterns placed one after another.
    Sequence { patterns: Vec<Pattern> },
    /// Child patterns sharing the same origin.
    Stack { patterns: Vec<Pattern> },
    /// A finite or unbounded repetition of one finite pattern.
    Repeat {
        pattern: Box<Pattern>,
        count: Option<u32>,
    },
    /// One deterministic transformation.
    Transform {
        transformation: Transformation,
        pattern: Box<Pattern>,
    },
    /// One deterministically selected branch.
    Choose {
        id: PatternId,
        patterns: Vec<Pattern>,
    },
    /// One deterministically selected weighted branch.
    WeightedChoose {
        id: PatternId,
        patterns: Vec<WeightedPattern>,
    },
    /// Drops each event independently using stable event coordinates.
    Omit {
        id: PatternId,
        probability: Probability,
        pattern: Box<Pattern>,
    },
    /// Applies a transformation to the whole occurrence with an exact probability.
    Sometimes {
        id: PatternId,
        probability: Probability,
        transformation: Transformation,
        pattern: Box<Pattern>,
    },
}

impl Pattern {
    /// Constructs a material source pattern.
    #[must_use]
    pub const fn material(material_id: MaterialId) -> Self {
        Self::Material { material_id }
    }

    /// Places patterns consecutively.
    #[must_use]
    pub fn sequence(patterns: impl IntoIterator<Item = Self>) -> Self {
        Self::Sequence {
            patterns: patterns.into_iter().collect(),
        }
    }

    /// Places patterns at the same origin.
    #[must_use]
    pub fn stack(patterns: impl IntoIterator<Item = Self>) -> Self {
        Self::Stack {
            patterns: patterns.into_iter().collect(),
        }
    }

    /// Repeats a finite pattern without an upper bound.
    #[must_use]
    pub fn repeat(self) -> Self {
        Self::Repeat {
            pattern: Box::new(self),
            count: None,
        }
    }

    /// Repeats a finite pattern at most `count` times.
    #[must_use]
    pub fn repeat_n(self, count: u32) -> Self {
        Self::Repeat {
            pattern: Box::new(self),
            count: Some(count),
        }
    }

    /// Applies a deterministic transformation.
    #[must_use]
    pub fn transform(self, transformation: Transformation) -> Self {
        Self::Transform {
            transformation,
            pattern: Box::new(self),
        }
    }

    /// Shifts matching-clock events by a signed offset.
    #[must_use]
    pub fn shift(self, offset: TimeOffset) -> Self {
        self.transform(Transformation::Shift { offset })
    }

    /// Stretches time by a positive exact factor.
    #[must_use]
    pub fn stretch(self, factor: TimeScale) -> Self {
        self.transform(Transformation::Stretch { factor })
    }

    /// Slows time by an exact factor.
    #[must_use]
    pub fn slow(self, factor: TimeScale) -> Self {
        self.stretch(factor)
    }

    /// Speeds time by the reciprocal of an exact factor.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError`] if the reciprocal cannot be represented.
    pub fn fast(self, factor: TimeScale) -> Result<Self, PatternError> {
        Ok(self.stretch(TimeScale::new(factor.denominator(), factor.numerator())?))
    }

    /// Rotates event starts within this pattern's finite duration.
    #[must_use]
    pub fn rotate(self, offset: TimeOffset) -> Self {
        self.transform(Transformation::Rotate { offset })
    }

    /// Reverses event spans within this pattern's finite duration.
    #[must_use]
    pub fn reverse(self) -> Self {
        self.transform(Transformation::Reverse)
    }

    /// Transposes all note events.
    #[must_use]
    pub fn transpose(self, interval: Interval) -> Self {
        self.transform(Transformation::Transpose { interval })
    }

    /// Selects one branch using a stable operator identity.
    #[must_use]
    pub fn choose(id: PatternId, patterns: impl IntoIterator<Item = Self>) -> Self {
        Self::Choose {
            id,
            patterns: patterns.into_iter().collect(),
        }
    }

    /// Selects one weighted branch using a stable operator identity.
    #[must_use]
    pub fn weighted_choose(
        id: PatternId,
        patterns: impl IntoIterator<Item = WeightedPattern>,
    ) -> Self {
        Self::WeightedChoose {
            id,
            patterns: patterns.into_iter().collect(),
        }
    }

    /// Omits each event with the requested probability.
    #[must_use]
    pub fn omit(self, id: PatternId, probability: Probability) -> Self {
        Self::Omit {
            id,
            probability,
            pattern: Box::new(self),
        }
    }

    /// Applies one transformation to an occurrence with the requested probability.
    #[must_use]
    pub fn sometimes(
        self,
        id: PatternId,
        probability: Probability,
        transformation: Transformation,
    ) -> Self {
        Self::Sometimes {
            id,
            probability,
            transformation,
            pattern: Box::new(self),
        }
    }

    /// Queries all events whose untrimmed spans overlap the requested half-open span.
    ///
    /// # Errors
    ///
    /// Returns [`PatternError`] for missing material, incompatible clock domains,
    /// unavailable finite durations, or exact arithmetic failures.
    pub fn query(
        &self,
        document: &Document,
        target: VoiceId,
        span: TimeSpan,
        seed: Seed,
    ) -> Result<Vec<Event>, PatternError> {
        let context = QueryContext {
            document,
            target,
            seed,
            coordinates: Vec::new(),
        };
        let requested = span.value();
        let mut events = query_pattern(self, requested, &context)?;
        events.retain(|event| event.span.overlaps(requested));
        events.sort_by(raw_event_order);
        events.dedup();
        events.into_iter().map(Event::try_from).collect()
    }

    /// Visits every material reference in stable tree order.
    pub(crate) fn material_ids(&self, output: &mut Vec<MaterialId>) {
        match self {
            Self::Material { material_id } => output.push(*material_id),
            Self::Sequence { patterns }
            | Self::Stack { patterns }
            | Self::Choose { patterns, .. } => {
                for pattern in patterns {
                    pattern.material_ids(output);
                }
            }
            Self::Repeat { pattern, .. }
            | Self::Transform { pattern, .. }
            | Self::Omit { pattern, .. }
            | Self::Sometimes { pattern, .. } => pattern.material_ids(output),
            Self::WeightedChoose { patterns, .. } => {
                for pattern in patterns {
                    pattern.pattern.material_ids(output);
                }
            }
        }
    }

    /// Collects structural errors that constructors cannot prevent after deserialization.
    pub(crate) fn validate_structure(&self, errors: &mut Vec<&'static str>) {
        match self {
            Self::Material { .. } => {}
            Self::Sequence { patterns } | Self::Stack { patterns } => {
                if patterns.is_empty() {
                    errors.push("sequence and stack patterns must contain at least one child");
                }
                for pattern in patterns {
                    pattern.validate_structure(errors);
                }
            }
            Self::Repeat { pattern, count } => {
                if *count == Some(0) {
                    errors.push("finite repeat patterns must repeat at least once");
                }
                pattern.validate_structure(errors);
            }
            Self::Transform { pattern, .. }
            | Self::Omit { pattern, .. }
            | Self::Sometimes { pattern, .. } => pattern.validate_structure(errors),
            Self::Choose { patterns, .. } => {
                if patterns.is_empty() {
                    errors.push("choice patterns must contain at least one branch");
                }
                for pattern in patterns {
                    pattern.validate_structure(errors);
                }
            }
            Self::WeightedChoose { patterns, .. } => {
                if patterns.is_empty() {
                    errors.push("weighted choice patterns must contain at least one branch");
                } else if !patterns.iter().any(|pattern| pattern.weight > 0) {
                    errors.push("weighted choice patterns require a positive branch weight");
                }
                for pattern in patterns {
                    pattern.pattern.validate_structure(errors);
                }
            }
        }
    }
}

/// A backend-independent event target.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(tag = "type", content = "id", rename_all = "snake_case")]
pub enum EventTarget {
    /// A canonical document voice.
    Voice(VoiceId),
    /// A symbolic target interpreted by a later adapter.
    Symbolic(String),
}

/// A typed note payload independent of MIDI messages and audio objects.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NoteEvent {
    pitch: Pitch,
    velocity: u8,
}

impl NoteEvent {
    /// Constructs a note event from authored pitch and velocity.
    #[must_use]
    pub const fn new(pitch: Pitch, velocity: u8) -> Self {
        Self { pitch, velocity }
    }

    /// Returns the chromatic pitch.
    #[must_use]
    pub const fn pitch(self) -> Pitch {
        self.pitch
    }

    /// Returns the authored velocity in the inclusive range `1..=127`.
    #[must_use]
    pub const fn velocity(self) -> u8 {
        self.velocity
    }
}

/// A backend-independent event payload.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum EventKind {
    /// A pitched note with authored velocity.
    Note { note: NoteEvent },
    /// An extension kind whose meaning belongs to a named adapter or later core feature.
    Named { name: String },
}

/// One extensible event property value.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum EventProperty {
    /// A switch-like value.
    Boolean(bool),
    /// A signed integral value.
    Integer(i64),
    /// Text or a symbolic reference.
    Text(String),
    /// A chromatic pitch value.
    Pitch(Pitch),
    /// An exact rational value serialized as `numerator/denominator`.
    Exact(Beats),
}

/// The authored source used to produce an event.
#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum EventSource {
    /// A note retained in phrase material.
    PhraseNote {
        material_id: MaterialId,
        note_id: NoteId,
    },
    /// An active step-pattern cell.
    StepCell {
        material_id: MaterialId,
        row: usize,
        step: usize,
    },
}

/// One normalized backend-independent event.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Event {
    span: TimeSpan,
    target: EventTarget,
    kind: EventKind,
    source: EventSource,
    properties: BTreeMap<String, EventProperty>,
}

impl Event {
    /// Returns the untrimmed event span.
    #[must_use]
    pub const fn span(&self) -> TimeSpan {
        self.span
    }

    /// Returns the event target.
    #[must_use]
    pub const fn target(&self) -> &EventTarget {
        &self.target
    }

    /// Returns the typed event payload.
    #[must_use]
    pub const fn kind(&self) -> &EventKind {
        &self.kind
    }

    /// Returns the authored source coordinate.
    #[must_use]
    pub const fn source(&self) -> &EventSource {
        &self.source
    }

    /// Returns extensible properties in stable key order.
    #[must_use]
    pub const fn properties(&self) -> &BTreeMap<String, EventProperty> {
        &self.properties
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Clock {
    Metric,
    Absolute,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ScalarSpan {
    clock: Clock,
    start: Rational,
    end: Rational,
}

impl ScalarSpan {
    fn duration(self) -> Result<Rational, PatternError> {
        Ok(self.end.checked_sub(self.start)?)
    }

    fn overlaps(self, other: Self) -> bool {
        self.clock == other.clock && self.start < other.end && self.end > other.start
    }

    fn shifted(self, amount: Rational) -> Result<Self, PatternError> {
        Ok(Self {
            clock: self.clock,
            start: self.start.checked_add(amount)?,
            end: self.end.checked_add(amount)?,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RawEvent {
    span: ScalarSpan,
    target: VoiceId,
    kind: EventKind,
    source: EventSource,
    properties: BTreeMap<String, EventProperty>,
}

impl TryFrom<RawEvent> for Event {
    type Error = PatternError;

    fn try_from(value: RawEvent) -> Result<Self, Self::Error> {
        Ok(Self {
            span: TimeSpan::new(
                TimePoint::from_scalar(value.span.clock, value.span.start),
                TimePoint::from_scalar(value.span.clock, value.span.end),
            )?,
            target: EventTarget::Voice(value.target),
            kind: value.kind,
            source: value.source,
            properties: value.properties,
        })
    }
}

struct QueryContext<'a> {
    document: &'a Document,
    target: VoiceId,
    seed: Seed,
    coordinates: Vec<i64>,
}

impl QueryContext<'_> {
    fn with_coordinate(&self, coordinate: i64) -> QueryContext<'_> {
        let mut coordinates = self.coordinates.clone();
        coordinates.push(coordinate);
        QueryContext {
            document: self.document,
            target: self.target,
            seed: self.seed,
            coordinates,
        }
    }
}

fn query_pattern(
    pattern: &Pattern,
    requested: ScalarSpan,
    context: &QueryContext<'_>,
) -> Result<Vec<RawEvent>, PatternError> {
    match pattern {
        Pattern::Material { material_id } => query_material(*material_id, requested, context),
        Pattern::Stack { patterns } => {
            let mut output = Vec::new();
            for pattern in patterns {
                output.extend(query_pattern(pattern, requested, context)?);
            }
            Ok(output)
        }
        Pattern::Sequence { patterns } => query_sequence(patterns, requested, context),
        Pattern::Repeat { pattern, count } => query_repeat(pattern, *count, requested, context),
        Pattern::Transform {
            transformation,
            pattern,
        } => query_transformed(pattern, transformation, requested, context),
        Pattern::Choose { id, patterns } => {
            if patterns.is_empty() {
                return Ok(Vec::new());
            }
            let upper = u64::try_from(patterns.len()).map_err(|_| TimeError::Overflow)?;
            let index = usize::try_from(stable_bounded(context, *id, 0, upper)?)
                .map_err(|_| TimeError::Overflow)?;
            query_pattern(&patterns[index], requested, context)
        }
        Pattern::WeightedChoose { id, patterns } => {
            let total = patterns.iter().try_fold(0_u64, |total, item| {
                total
                    .checked_add(u64::from(item.weight))
                    .ok_or(PatternError::InvalidWeights)
            })?;
            if total == 0 {
                return Err(PatternError::InvalidWeights);
            }
            let mut choice = stable_bounded(context, *id, 0, total)?;
            for item in patterns {
                if choice < u64::from(item.weight) {
                    return query_pattern(&item.pattern, requested, context);
                }
                choice -= u64::from(item.weight);
            }
            Err(PatternError::InvalidWeights)
        }
        Pattern::Omit {
            id,
            probability,
            pattern,
        } => {
            let events = query_pattern(pattern, requested, context)?;
            let mut retained = Vec::with_capacity(events.len());
            for event in events {
                if !stable_probability(context, *id, event_key(&event)?, *probability)? {
                    retained.push(event);
                }
            }
            Ok(retained)
        }
        Pattern::Sometimes {
            id,
            probability,
            transformation,
            pattern,
        } => {
            if stable_probability(context, *id, 0, *probability)? {
                query_transformed(pattern, transformation, requested, context)
            } else {
                query_pattern(pattern, requested, context)
            }
        }
    }
}

fn query_material(
    material_id: MaterialId,
    requested: ScalarSpan,
    context: &QueryContext<'_>,
) -> Result<Vec<RawEvent>, PatternError> {
    let material = context
        .document
        .piece()
        .materials()
        .get(&material_id)
        .ok_or(PatternError::MissingMaterial(material_id))?;
    let mut events = Vec::new();
    match material {
        Material::Phrase { phrase, .. } => {
            for note in phrase.notes().values() {
                let span = note_span(note.time())?;
                if span.overlaps(requested) {
                    events.push(RawEvent {
                        span,
                        target: context.target,
                        kind: EventKind::Note {
                            note: NoteEvent::new(note.pitch(), note.velocity()),
                        },
                        source: EventSource::PhraseNote {
                            material_id,
                            note_id: note.id(),
                        },
                        properties: BTreeMap::new(),
                    });
                }
            }
        }
        Material::StepPattern { pattern, .. } if requested.clock == Clock::Metric => {
            let duration = pattern.subdivision().0;
            for (row_index, row) in pattern.rows().iter().enumerate() {
                for (step, _) in row
                    .cells()
                    .iter()
                    .enumerate()
                    .filter(|(_, cell)| cell.active())
                {
                    let start =
                        Rational::new(i64::try_from(step).map_err(|_| TimeError::Overflow)?, 1)?
                            .checked_mul(duration)?;
                    let span = ScalarSpan {
                        clock: Clock::Metric,
                        start,
                        end: start.checked_add(duration)?,
                    };
                    if span.overlaps(requested) {
                        events.push(RawEvent {
                            span,
                            target: context.target,
                            kind: EventKind::Note {
                                note: NoteEvent::new(row.pitch(), 100),
                            },
                            source: EventSource::StepCell {
                                material_id,
                                row: row_index,
                                step,
                            },
                            properties: BTreeMap::new(),
                        });
                    }
                }
            }
        }
        Material::StepPattern { .. } | Material::PitchSet { .. } => {}
    }
    Ok(events)
}

fn note_span(time: &NoteTime) -> Result<ScalarSpan, PatternError> {
    match time {
        NoteTime::Metric { onset, duration } => Ok(ScalarSpan {
            clock: Clock::Metric,
            start: onset.0,
            end: onset.0.checked_add(duration.0)?,
        }),
        NoteTime::Absolute { onset, duration } => Ok(ScalarSpan {
            clock: Clock::Absolute,
            start: onset.0,
            end: onset.0.checked_add(duration.0)?,
        }),
    }
}

fn pattern_duration(pattern: &Pattern, document: &Document) -> Result<ScalarSpan, PatternError> {
    let zero = Rational::new(0, 1)?;
    match pattern {
        Pattern::Material { material_id } => {
            let material = document
                .piece()
                .materials()
                .get(material_id)
                .ok_or(PatternError::MissingMaterial(*material_id))?;
            match material {
                Material::Phrase { phrase, .. } => {
                    let mut clock = None;
                    let mut end = zero;
                    for note in phrase.notes().values() {
                        let span = note_span(note.time())?;
                        if clock.is_some_and(|value| value != span.clock) {
                            return Err(PatternError::DurationRequired("mixed-clock phrase"));
                        }
                        clock = Some(span.clock);
                        end = end.max(span.end);
                    }
                    let clock = clock.ok_or(PatternError::DurationRequired("empty material"))?;
                    positive_duration(clock, end)
                }
                Material::StepPattern { pattern, .. } => {
                    let steps = Rational::new(
                        i64::try_from(pattern.steps()).map_err(|_| TimeError::Overflow)?,
                        1,
                    )?;
                    positive_duration(Clock::Metric, pattern.subdivision().0.checked_mul(steps)?)
                }
                Material::PitchSet { .. } => Err(PatternError::DurationRequired("pitch set")),
            }
        }
        Pattern::Sequence { patterns } => {
            let mut clock = None;
            let mut total = zero;
            for child in patterns {
                let duration = pattern_duration(child, document)?;
                if clock.is_some_and(|value| value != duration.clock) {
                    return Err(PatternError::DurationRequired("mixed-clock sequence"));
                }
                clock = Some(duration.clock);
                total = total.checked_add(duration.end)?;
            }
            positive_duration(
                clock.ok_or(PatternError::DurationRequired("empty sequence"))?,
                total,
            )
        }
        Pattern::Stack { patterns } => {
            let mut clock = None;
            let mut end = zero;
            for child in patterns {
                let duration = pattern_duration(child, document)?;
                if clock.is_some_and(|value| value != duration.clock) {
                    return Err(PatternError::DurationRequired("mixed-clock stack"));
                }
                clock = Some(duration.clock);
                end = end.max(duration.end);
            }
            positive_duration(
                clock.ok_or(PatternError::DurationRequired("empty stack"))?,
                end,
            )
        }
        Pattern::Repeat { pattern, count } => {
            let count = count.ok_or(PatternError::DurationRequired("unbounded repeat"))?;
            let duration = pattern_duration(pattern, document)?;
            let factor = Rational::new(i64::from(count), 1)?;
            positive_duration(duration.clock, duration.end.checked_mul(factor)?)
        }
        Pattern::Transform {
            transformation,
            pattern,
        } => transformed_duration(pattern, transformation, document),
        Pattern::Sometimes {
            transformation,
            pattern,
            ..
        } => {
            let original = pattern_duration(pattern, document)?;
            let transformed = transformed_duration(pattern, transformation, document)?;
            if original.clock != transformed.clock {
                return Err(PatternError::DurationRequired(
                    "clock-mismatched conditional transformation",
                ));
            }
            positive_duration(original.clock, original.end.max(transformed.end))
        }
        Pattern::Choose { patterns, .. } => common_choice_duration(patterns, document),
        Pattern::WeightedChoose { patterns, .. } => {
            let branches: Vec<_> = patterns.iter().map(|item| item.pattern.clone()).collect();
            common_choice_duration(&branches, document)
        }
        Pattern::Omit { pattern, .. } => pattern_duration(pattern, document),
    }
}

fn positive_duration(clock: Clock, end: Rational) -> Result<ScalarSpan, PatternError> {
    if !end.is_positive() {
        return Err(PatternError::DurationRequired("zero-length pattern"));
    }
    Ok(ScalarSpan {
        clock,
        start: Rational::new(0, 1)?,
        end,
    })
}

fn common_choice_duration(
    patterns: &[Pattern],
    document: &Document,
) -> Result<ScalarSpan, PatternError> {
    let mut durations = patterns
        .iter()
        .map(|pattern| pattern_duration(pattern, document));
    let first = durations
        .next()
        .ok_or(PatternError::DurationRequired("empty choice"))??;
    for duration in durations {
        if duration? != first {
            return Err(PatternError::DurationRequired("unequal choice branches"));
        }
    }
    Ok(first)
}

fn transformed_duration(
    pattern: &Pattern,
    transformation: &Transformation,
    document: &Document,
) -> Result<ScalarSpan, PatternError> {
    let duration = pattern_duration(pattern, document)?;
    match transformation {
        Transformation::Stretch { factor } => {
            positive_duration(duration.clock, duration.end.checked_mul(factor.0)?)
        }
        Transformation::Shift { offset } => {
            let (clock, amount) = offset.scalar();
            if clock != duration.clock {
                return Err(PatternError::DurationRequired("clock-mismatched shift"));
            }
            positive_duration(clock, duration.end.checked_add(amount)?)
        }
        Transformation::Rotate { offset } => {
            if offset.scalar().0 != duration.clock {
                return Err(PatternError::DurationRequired("clock-mismatched rotation"));
            }
            Ok(duration)
        }
        Transformation::Reverse | Transformation::Transpose { .. } => Ok(duration),
    }
}

fn query_sequence(
    patterns: &[Pattern],
    requested: ScalarSpan,
    context: &QueryContext<'_>,
) -> Result<Vec<RawEvent>, PatternError> {
    let durations = patterns
        .iter()
        .map(|pattern| pattern_duration(pattern, context.document))
        .collect::<Result<Vec<_>, _>>()?;
    if durations
        .iter()
        .any(|duration| duration.clock != durations[0].clock)
    {
        return Err(PatternError::DurationRequired("mixed-clock sequence"));
    }
    if durations
        .first()
        .is_some_and(|duration| duration.clock != requested.clock)
    {
        return Ok(Vec::new());
    }

    let mut output = Vec::new();
    let mut offset = Rational::new(0, 1)?;
    for (pattern, duration) in patterns.iter().zip(durations) {
        let local = ScalarSpan {
            clock: requested.clock,
            start: requested.start.checked_sub(offset)?,
            end: requested.end.checked_sub(offset)?,
        };
        if local.start < duration.end && local.end > duration.start {
            output.extend(
                query_pattern(pattern, local, context)?
                    .into_iter()
                    .map(|mut event| {
                        event.span = event.span.shifted(offset)?;
                        Ok(event)
                    })
                    .collect::<Result<Vec<_>, PatternError>>()?,
            );
        }
        offset = offset.checked_add(duration.end)?;
    }
    Ok(output)
}

fn query_repeat(
    pattern: &Pattern,
    count: Option<u32>,
    requested: ScalarSpan,
    context: &QueryContext<'_>,
) -> Result<Vec<RawEvent>, PatternError> {
    let duration = pattern_duration(pattern, context.document)?;
    if duration.clock != requested.clock {
        return Ok(Vec::new());
    }
    let mut first = requested
        .start
        .checked_div(duration.end)?
        .floor_integer()?
        .checked_sub(1)
        .ok_or(TimeError::Overflow)?;
    first = first.max(0);
    let mut last = requested
        .end
        .checked_div(duration.end)?
        .floor_integer()?
        .checked_add(1)
        .ok_or(TimeError::Overflow)?;
    if let Some(count) = count {
        last = last.min(i64::from(count));
    }
    let mut output = Vec::new();
    for occurrence in first..last {
        let offset = duration.end.checked_mul(Rational::new(occurrence, 1)?)?;
        let local = ScalarSpan {
            clock: requested.clock,
            start: requested.start.checked_sub(offset)?,
            end: requested.end.checked_sub(offset)?,
        };
        let occurrence_context = context.with_coordinate(occurrence);
        for mut event in query_pattern(pattern, local, &occurrence_context)? {
            event.span = event.span.shifted(offset)?;
            output.push(event);
        }
    }
    Ok(output)
}

fn query_transformed(
    pattern: &Pattern,
    transformation: &Transformation,
    requested: ScalarSpan,
    context: &QueryContext<'_>,
) -> Result<Vec<RawEvent>, PatternError> {
    match transformation {
        Transformation::Shift { offset } => {
            let (clock, amount) = offset.scalar();
            if clock != requested.clock {
                return query_pattern(pattern, requested, context);
            }
            let source_request = ScalarSpan {
                clock,
                start: requested.start.checked_sub(amount)?,
                end: requested.end.checked_sub(amount)?,
            };
            let mut events = query_pattern(pattern, source_request, context)?;
            for event in &mut events {
                event.span = event.span.shifted(amount)?;
            }
            Ok(events)
        }
        Transformation::Stretch { factor } => {
            let source_request = ScalarSpan {
                clock: requested.clock,
                start: requested.start.checked_div(factor.0)?,
                end: requested.end.checked_div(factor.0)?,
            };
            let mut events = query_pattern(pattern, source_request, context)?;
            for event in &mut events {
                event.span.start = event.span.start.checked_mul(factor.0)?;
                event.span.end = event.span.end.checked_mul(factor.0)?;
            }
            Ok(events)
        }
        Transformation::Transpose { interval } => {
            let mut events = query_pattern(pattern, requested, context)?;
            for event in &mut events {
                if let EventKind::Note { note } = &mut event.kind {
                    note.pitch = note.pitch.transpose(*interval)?;
                }
            }
            Ok(events)
        }
        Transformation::Rotate { offset } => {
            let duration = pattern_duration(pattern, context.document)?;
            let (clock, amount) = offset.scalar();
            if clock != duration.clock || clock != requested.clock {
                return Err(PatternError::DurationRequired("clock-mismatched rotation"));
            }
            let mut events = query_pattern(pattern, duration, context)?;
            for event in &mut events {
                let shifted = event.span.start.checked_add(amount)?;
                let cycles = shifted.checked_div(duration.end)?.floor_integer()?;
                let wrapped =
                    shifted.checked_sub(duration.end.checked_mul(Rational::new(cycles, 1)?)?)?;
                let event_duration = event.span.duration()?;
                event.span.start = wrapped;
                event.span.end = wrapped.checked_add(event_duration)?;
            }
            events.retain(|event| event.span.overlaps(requested));
            Ok(events)
        }
        Transformation::Reverse => {
            let duration = pattern_duration(pattern, context.document)?;
            if duration.clock != requested.clock {
                return Ok(Vec::new());
            }
            let mut events = query_pattern(pattern, duration, context)?;
            for event in &mut events {
                let start = duration.end.checked_sub(event.span.end)?;
                let end = duration.end.checked_sub(event.span.start)?;
                event.span.start = start;
                event.span.end = end;
            }
            events.retain(|event| event.span.overlaps(requested));
            Ok(events)
        }
    }
}

fn stable_probability(
    context: &QueryContext<'_>,
    id: PatternId,
    local_key: u64,
    probability: Probability,
) -> Result<bool, PatternError> {
    if probability.numerator == 0 {
        return Ok(false);
    }
    if probability.numerator == probability.denominator {
        return Ok(true);
    }
    Ok(
        stable_bounded(context, id, local_key, u64::from(probability.denominator))?
            < u64::from(probability.numerator),
    )
}

fn stable_bounded(
    context: &QueryContext<'_>,
    id: PatternId,
    local_key: u64,
    upper: u64,
) -> Result<u64, PatternError> {
    if upper == 0 {
        return Err(PatternError::InvalidWeights);
    }
    let mut input = Vec::with_capacity(48 + context.coordinates.len() * 8);
    input.extend_from_slice(&context.seed.value().to_le_bytes());
    input.extend_from_slice(context.target.as_uuid().as_bytes());
    input.extend_from_slice(id.as_uuid().as_bytes());
    input.extend_from_slice(
        &u32::try_from(context.coordinates.len())
            .map_err(|_| TimeError::Overflow)?
            .to_le_bytes(),
    );
    for coordinate in &context.coordinates {
        input.extend_from_slice(&coordinate.to_le_bytes());
    }
    input.extend_from_slice(&local_key.to_le_bytes());
    let derived = blake3::derive_key(RANDOM_CONTEXT, &input);
    let mut rng = ChaCha8Rng::from_seed(derived);
    let threshold = upper.wrapping_neg() % upper;
    loop {
        let value = rng.next_u64();
        if value >= threshold {
            return Ok(value % upper);
        }
    }
}

fn event_key(event: &RawEvent) -> Result<u64, PatternError> {
    let mut hasher = blake3::Hasher::new_derive_key(RANDOM_CONTEXT);
    hasher.update(&[clock_order(event.span.clock)]);
    hasher.update(&event.span.start.numerator().to_le_bytes());
    hasher.update(&event.span.start.denominator().to_le_bytes());
    match &event.source {
        EventSource::PhraseNote {
            material_id,
            note_id,
        } => {
            hasher.update(&[0]);
            hasher.update(material_id.as_uuid().as_bytes());
            hasher.update(note_id.as_uuid().as_bytes());
        }
        EventSource::StepCell {
            material_id,
            row,
            step,
        } => {
            hasher.update(&[1]);
            hasher.update(material_id.as_uuid().as_bytes());
            hasher.update(
                &u64::try_from(*row)
                    .map_err(|_| TimeError::Overflow)?
                    .to_le_bytes(),
            );
            hasher.update(
                &u64::try_from(*step)
                    .map_err(|_| TimeError::Overflow)?
                    .to_le_bytes(),
            );
        }
    }
    let hash = hasher.finalize();
    let mut bytes = [0; 8];
    bytes.copy_from_slice(&hash.as_bytes()[..8]);
    Ok(u64::from_le_bytes(bytes))
}

fn raw_event_order(left: &RawEvent, right: &RawEvent) -> Ordering {
    clock_order(left.span.clock)
        .cmp(&clock_order(right.span.clock))
        .then(left.span.start.cmp(&right.span.start))
        .then(left.span.end.cmp(&right.span.end))
        .then(left.target.cmp(&right.target))
        .then(left.source.cmp(&right.source))
        .then(left.kind.cmp(&right.kind))
        .then(left.properties.cmp(&right.properties))
}

const fn clock_order(clock: Clock) -> u8 {
    match clock {
        Clock::Metric => 0,
        Clock::Absolute => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::{
        DocumentId, Material, Metadata, Note, Operation, Phrase, Piece, PieceId, SoundRef,
        StepPattern, Transport, Voice, VoiceSettings,
    };
    use crate::time::{AbsoluteDuration, AbsoluteTime, Meter, Tempo};

    fn parse<T: FromStr>(value: &str) -> T
    where
        T::Err: fmt::Debug,
    {
        value.parse().unwrap()
    }

    fn fixture() -> (Document, VoiceId, MaterialId, MaterialId) {
        let phrase_id = parse("0f87ac6e-ea2c-43e7-9694-04b90e776f61");
        let steps_id = parse("313b2f8d-8c00-4d82-82f6-cdb7aeb112de");
        let voice_id = parse("826b8913-4c23-43e1-b150-594737909a58");
        let mut document = Document::new(
            parse::<DocumentId>("9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860"),
            Metadata::new(),
            Seed::new(42),
            Piece::new(
                parse::<PieceId>("98d4060e-3f83-4299-8932-9cf757a16a76"),
                Transport::new(Tempo::new(120, 1).unwrap(), Some(Meter::new(4, 4).unwrap())),
            ),
        );
        document
            .apply(Operation::AddMaterial(Material::phrase(
                phrase_id,
                "Phrase",
                Phrase::new(),
            )))
            .unwrap();
        document
            .apply(Operation::InsertNote {
                material_id: phrase_id,
                note: Note::new(
                    parse("92b8d664-2b27-45ca-a7c2-f816124fe813"),
                    Pitch::from_semitones(60),
                    NoteTime::Metric {
                        onset: Beats::new(0, 1).unwrap(),
                        duration: Beats::new(1, 2).unwrap(),
                    },
                    90,
                )
                .unwrap(),
            })
            .unwrap();
        let steps =
            StepPattern::new(4, Beats::new(1, 1).unwrap(), [Pitch::from_semitones(67)]).unwrap();
        document
            .apply(Operation::AddMaterial(Material::step_pattern(
                steps_id, "Steps", steps,
            )))
            .unwrap();
        document
            .apply(Operation::UpdateMatrixCell {
                material_id: steps_id,
                row: 0,
                step: 1,
                active: true,
            })
            .unwrap();
        document
            .apply(Operation::AddVoice(Voice::new(
                voice_id,
                VoiceSettings::new("Voice", SoundRef::new("felt-piano").unwrap())
                    .with_material(phrase_id),
            )))
            .unwrap();
        (document, voice_id, phrase_id, steps_id)
    }

    #[test]
    fn phrase_and_steps_obey_half_open_overlap_boundaries() {
        let (document, voice, phrase, steps) = fixture();
        let span = TimeSpan::metric(Beats::new(1, 2).unwrap(), Beats::new(2, 1).unwrap()).unwrap();
        let phrase_events = Pattern::material(phrase)
            .query(&document, voice, span, document.seed())
            .unwrap();
        assert!(
            phrase_events.is_empty(),
            "an event ending at the start is excluded"
        );
        let step_events = Pattern::material(steps)
            .query(&document, voice, span, document.seed())
            .unwrap();
        assert_eq!(step_events.len(), 1);
        assert_eq!(
            step_events[0].span().start(),
            TimePoint::Metric(Beats::new(1, 1).unwrap())
        );
    }

    #[test]
    fn adjacent_and_combined_repeat_queries_agree_without_rendering_from_zero() {
        let (document, voice, phrase, _) = fixture();
        let pattern = Pattern::material(phrase).repeat();
        let first =
            TimeSpan::metric(Beats::new(100, 1).unwrap(), Beats::new(101, 1).unwrap()).unwrap();
        let second =
            TimeSpan::metric(Beats::new(101, 1).unwrap(), Beats::new(102, 1).unwrap()).unwrap();
        let combined =
            TimeSpan::metric(Beats::new(100, 1).unwrap(), Beats::new(102, 1).unwrap()).unwrap();
        let mut adjacent = pattern
            .query(&document, voice, first, document.seed())
            .unwrap();
        adjacent.extend(
            pattern
                .query(&document, voice, second, document.seed())
                .unwrap(),
        );
        adjacent.sort_by_key(|event| event.span().start());
        assert_eq!(
            adjacent,
            pattern
                .query(&document, voice, combined, document.seed())
                .unwrap()
        );
    }

    #[test]
    fn structural_and_temporal_transformations_compose() {
        let (document, voice, phrase, steps) = fixture();
        let pattern = Pattern::sequence([
            Pattern::material(phrase).transpose(Interval::semitones(12)),
            Pattern::material(steps).reverse(),
        ])
        .repeat_n(2)
        .stretch(TimeScale::new(2, 1).unwrap())
        .shift(TimeOffset::Metric(Beats::new(1, 1).unwrap()));
        let events = pattern
            .query(
                &document,
                voice,
                TimeSpan::metric(Beats::new(0, 1).unwrap(), Beats::new(20, 1).unwrap()).unwrap(),
                document.seed(),
            )
            .unwrap();
        assert_eq!(events.len(), 4);
        let EventKind::Note { note } = events[0].kind() else {
            panic!("fixture must emit notes");
        };
        assert_eq!(note.pitch(), Pitch::from_semitones(72));
    }

    #[test]
    fn stochastic_choices_are_stable_across_query_shapes() {
        let (document, voice, phrase, _) = fixture();
        let choose_id = parse("f0e6fbb1-3d76-4522-8c71-a8aa3af82c16");
        let omit_id = parse("9f4c7918-0254-49d0-ac02-dbc89930fb86");
        let pattern = Pattern::choose(
            choose_id,
            [
                Pattern::material(phrase),
                Pattern::material(phrase).transpose(Interval::semitones(7)),
            ],
        )
        .omit(omit_id, Probability::new(1, 4).unwrap())
        .repeat();
        let span =
            TimeSpan::metric(Beats::new(20, 1).unwrap(), Beats::new(28, 1).unwrap()).unwrap();
        let first = pattern
            .query(&document, voice, span, Seed::new(99))
            .unwrap();
        let second = pattern
            .query(&document, voice, span, Seed::new(99))
            .unwrap();
        assert_eq!(first, second);
    }

    #[test]
    fn absolute_patterns_need_no_tempo_and_can_share_a_document_with_metric_patterns() {
        let (mut document, voice, _, steps) = fixture();
        let absolute_id = parse("745bd4a8-c38b-48a8-8cd6-12e5c62172a8");
        let mut phrase = Phrase::new();
        document
            .apply(Operation::AddMaterial(Material::phrase(
                absolute_id,
                "Absolute",
                phrase.clone(),
            )))
            .unwrap();
        document
            .apply(Operation::InsertNote {
                material_id: absolute_id,
                note: Note::new(
                    parse("1b73708d-2164-4a30-877f-ab652ac79d35"),
                    Pitch::from_semitones(48),
                    NoteTime::Absolute {
                        onset: AbsoluteTime::new(172, 10).unwrap(),
                        duration: AbsoluteDuration::new(1, 1).unwrap(),
                    },
                    80,
                )
                .unwrap(),
            })
            .unwrap();
        phrase = match document.piece().materials().get(&absolute_id).unwrap() {
            Material::Phrase { phrase, .. } => phrase.clone(),
            _ => unreachable!(),
        };
        assert_eq!(phrase.notes().len(), 1);
        let pattern = Pattern::stack([Pattern::material(absolute_id), Pattern::material(steps)]);
        let absolute = pattern
            .query(
                &document,
                voice,
                TimeSpan::absolute(Seconds::new(17, 1).unwrap(), Seconds::new(19, 1).unwrap())
                    .unwrap(),
                document.seed(),
            )
            .unwrap();
        assert_eq!(absolute.len(), 1);
        let metric = pattern
            .query(
                &document,
                voice,
                TimeSpan::metric(Beats::new(0, 1).unwrap(), Beats::new(2, 1).unwrap()).unwrap(),
                document.seed(),
            )
            .unwrap();
        assert_eq!(metric.len(), 1);
    }

    #[test]
    fn persisted_generative_voice_is_deterministic() {
        let (mut document, voice, phrase, _) = fixture();
        let weighted_id = parse("f0e6fbb1-3d76-4522-8c71-a8aa3af82c16");
        let sometimes_id = parse("9f4c7918-0254-49d0-ac02-dbc89930fb86");
        let pattern = Pattern::weighted_choose(
            weighted_id,
            [
                WeightedPattern::new(1, Pattern::material(phrase)),
                WeightedPattern::new(
                    3,
                    Pattern::material(phrase).transpose(Interval::semitones(7)),
                ),
            ],
        )
        .sometimes(
            sometimes_id,
            Probability::new(1, 2).unwrap(),
            Transformation::Transpose {
                interval: Interval::semitones(12),
            },
        )
        .repeat();
        document
            .apply(Operation::UpdateVoiceSettings {
                id: voice,
                settings: VoiceSettings::new("Generator", SoundRef::new("glass").unwrap())
                    .with_pattern(pattern),
            })
            .unwrap();
        let span =
            TimeSpan::metric(Beats::new(16, 1).unwrap(), Beats::new(20, 1).unwrap()).unwrap();
        let first = document.query_events(span).unwrap();
        assert!(!first.is_empty());
        assert_eq!(first, document.query_events(span).unwrap());

        let loaded = Document::from_json(&document.to_json().unwrap()).unwrap();
        assert_eq!(first, loaded.query_events(span).unwrap());
    }

    #[test]
    fn rotate_and_fast_preserve_exact_event_timing() {
        let (document, voice, _, steps) = fixture();
        let pattern = Pattern::material(steps)
            .rotate(TimeOffset::Metric(Beats::new(1, 1).unwrap()))
            .fast(TimeScale::new(2, 1).unwrap())
            .unwrap();
        let events = pattern
            .query(
                &document,
                voice,
                TimeSpan::metric(Beats::new(0, 1).unwrap(), Beats::new(2, 1).unwrap()).unwrap(),
                document.seed(),
            )
            .unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0].span(),
            TimeSpan::metric(Beats::new(1, 1).unwrap(), Beats::new(3, 2).unwrap()).unwrap()
        );
    }

    #[test]
    fn random_derivation_has_a_golden_vector() {
        let (document, voice, _, _) = fixture();
        let context = QueryContext {
            document: &document,
            target: voice,
            seed: Seed::new(42),
            coordinates: vec![3, 9],
        };
        let id = parse("f0e6fbb1-3d76-4522-8c71-a8aa3af82c16");
        assert_eq!(stable_bounded(&context, id, 7, 10_000).unwrap(), 7_059);
    }
}
