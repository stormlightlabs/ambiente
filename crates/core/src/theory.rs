//! Small chromatic pitch and interval primitives.

use std::collections::BTreeSet;

use serde::{Deserialize, Deserializer, Serialize, de};
use thiserror::Error;

/// An error produced by a pitch or collection operation.
#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum TheoryError {
    /// A chromatic pitch class was outside `0..12`.
    #[error("pitch class must be between 0 and 11")]
    InvalidPitchClass,
    /// A lower pitch was greater than an upper pitch.
    #[error("pitch range minimum must not exceed its maximum")]
    ReversedRange,
    /// A pitch calculation exceeded the supported representation.
    #[error("pitch arithmetic overflowed")]
    PitchOverflow,
    /// A scale omitted its root offset.
    #[error("a scale must include chromatic offset 0")]
    MissingScaleRoot,
}

/// A chromatic pitch measured in semitones from C0.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct Pitch(i16);

impl Pitch {
    /// Constructs a pitch from its semitone offset above or below C0.
    #[must_use]
    pub const fn from_semitones(semitones_from_c0: i16) -> Self {
        Self(semitones_from_c0)
    }

    /// Constructs a pitch from a pitch class and octave register, where register 0 starts at C0.
    ///
    /// # Errors
    ///
    /// Returns [`TheoryError::PitchOverflow`] when the pitch exceeds the supported range.
    pub fn in_register(class: PitchClass, register: Register) -> Result<Self, TheoryError> {
        let semitones = i32::from(register.0)
            .checked_mul(12)
            .and_then(|value| value.checked_add(i32::from(class.0)))
            .ok_or(TheoryError::PitchOverflow)?;
        i16::try_from(semitones)
            .map(Self)
            .map_err(|_| TheoryError::PitchOverflow)
    }

    /// Returns this pitch's semitone offset from C0.
    #[must_use]
    pub const fn semitones_from_c0(self) -> i16 {
        self.0
    }

    /// Returns this pitch's chromatic class.
    #[must_use]
    pub fn pitch_class(self) -> PitchClass {
        PitchClass(u8::try_from(self.0.rem_euclid(12)).unwrap_or_default())
    }

    /// Returns this pitch's octave register, where C0 begins register 0.
    #[must_use]
    pub const fn register(self) -> Register {
        Register(self.0.div_euclid(12))
    }

    /// Transposes this pitch by a chromatic interval.
    ///
    /// # Errors
    ///
    /// Returns [`TheoryError::PitchOverflow`] when the result exceeds the supported range.
    pub fn transpose(self, interval: Interval) -> Result<Self, TheoryError> {
        self.0
            .checked_add(interval.0)
            .map(Self)
            .ok_or(TheoryError::PitchOverflow)
    }
}

/// One of the twelve equal-tempered chromatic pitch classes (`C = 0`).
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct PitchClass(u8);

impl PitchClass {
    /// Constructs a pitch class from a value in `0..12`.
    ///
    /// # Errors
    ///
    /// Returns [`TheoryError::InvalidPitchClass`] when `value` is greater than 11.
    pub const fn new(value: u8) -> Result<Self, TheoryError> {
        if value < 12 {
            Ok(Self(value))
        } else {
            Err(TheoryError::InvalidPitchClass)
        }
    }

    /// Returns the chromatic value, where C is zero.
    #[must_use]
    pub const fn value(self) -> u8 {
        self.0
    }

    /// Transposes this class with octave wrapping.
    #[must_use]
    pub fn transpose(self, interval: Interval) -> Self {
        let value = (i32::from(self.0) + i32::from(interval.0)).rem_euclid(12);
        Self(u8::try_from(value).unwrap_or_default())
    }
}

impl<'de> Deserialize<'de> for PitchClass {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        Self::new(u8::deserialize(deserializer)?).map_err(de::Error::custom)
    }
}

/// A directed chromatic interval measured in semitones.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct Interval(i16);

impl Interval {
    /// Constructs a directed chromatic interval.
    #[must_use]
    pub const fn semitones(semitones: i16) -> Self {
        Self(semitones)
    }

    /// Returns the signed semitone distance.
    #[must_use]
    pub const fn value(self) -> i16 {
        self.0
    }
}

/// An octave register where C0 begins register zero.
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct Register(i16);

impl Register {
    /// Constructs an octave register.
    #[must_use]
    pub const fn new(value: i16) -> Self {
        Self(value)
    }

    /// Returns the signed octave number.
    #[must_use]
    pub const fn value(self) -> i16 {
        self.0
    }
}

/// An inclusive chromatic pitch range.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PitchRange {
    min: Pitch,
    max: Pitch,
}

impl PitchRange {
    /// Constructs an inclusive range.
    ///
    /// # Errors
    ///
    /// Returns [`TheoryError::ReversedRange`] when `min` is above `max`.
    pub const fn new(min: Pitch, max: Pitch) -> Result<Self, TheoryError> {
        if min.0 <= max.0 {
            Ok(Self { min, max })
        } else {
            Err(TheoryError::ReversedRange)
        }
    }

    /// Returns the lower inclusive pitch.
    #[must_use]
    pub const fn min(self) -> Pitch {
        self.min
    }

    /// Returns the upper inclusive pitch.
    #[must_use]
    pub const fn max(self) -> Pitch {
        self.max
    }

    /// Reports whether a pitch lies inside this range.
    #[must_use]
    pub const fn contains(self, pitch: Pitch) -> bool {
        pitch.0 >= self.min.0 && pitch.0 <= self.max.0
    }

    /// Clamps a pitch to this range.
    #[must_use]
    pub fn clamp(self, pitch: Pitch) -> Pitch {
        Pitch(pitch.0.clamp(self.min.0, self.max.0))
    }

    /// Transposes both range endpoints.
    ///
    /// # Errors
    ///
    /// Returns [`TheoryError::PitchOverflow`] when either endpoint overflows.
    pub fn transpose(self, interval: Interval) -> Result<Self, TheoryError> {
        Self::new(self.min.transpose(interval)?, self.max.transpose(interval)?)
    }
}

impl<'de> Deserialize<'de> for PitchRange {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct WireRange {
            min: Pitch,
            max: Pitch,
        }

        let value = WireRange::deserialize(deserializer)?;
        Self::new(value.min, value.max).map_err(de::Error::custom)
    }
}

/// A sorted collection of distinct concrete pitches.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize)]
#[serde(transparent)]
pub struct PitchSet(Vec<Pitch>);

impl PitchSet {
    /// Constructs a set by sorting pitches and removing duplicates.
    #[must_use]
    pub fn new(pitches: impl IntoIterator<Item = Pitch>) -> Self {
        Self(
            pitches
                .into_iter()
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect(),
        )
    }

    /// Returns the pitches in ascending order.
    #[must_use]
    pub fn pitches(&self) -> &[Pitch] {
        &self.0
    }

    /// Reports whether the set contains a pitch.
    #[must_use]
    pub fn contains(&self, pitch: Pitch) -> bool {
        self.0.binary_search(&pitch).is_ok()
    }

    /// Returns a transposed set.
    ///
    /// # Errors
    ///
    /// Returns [`TheoryError::PitchOverflow`] when any pitch overflows.
    pub fn transpose(&self, interval: Interval) -> Result<Self, TheoryError> {
        self.0
            .iter()
            .copied()
            .map(|pitch| pitch.transpose(interval))
            .collect::<Result<Vec<_>, _>>()
            .map(Self::new)
    }
}

impl<'de> Deserialize<'de> for PitchSet {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let pitches = Vec::<Pitch>::deserialize(deserializer)?;
        let set = Self::new(pitches.iter().copied());
        if set.0 != pitches {
            return Err(de::Error::custom(
                "pitch set values must be sorted and distinct",
            ));
        }
        Ok(set)
    }
}

/// A root pitch class and sorted chromatic offsets that define a scale.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Scale {
    root: PitchClass,
    offsets: Vec<PitchClass>,
}

impl Scale {
    /// Constructs a scale. Offsets are normalized to sorted, distinct pitch classes.
    ///
    /// # Errors
    ///
    /// Returns [`TheoryError::MissingScaleRoot`] when offset zero is absent.
    pub fn new(
        root: PitchClass,
        offsets: impl IntoIterator<Item = PitchClass>,
    ) -> Result<Self, TheoryError> {
        let offsets: Vec<_> = offsets
            .into_iter()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        if !offsets.contains(&PitchClass(0)) {
            return Err(TheoryError::MissingScaleRoot);
        }
        Ok(Self { root, offsets })
    }

    /// Returns the scale root.
    #[must_use]
    pub const fn root(&self) -> PitchClass {
        self.root
    }

    /// Returns sorted chromatic offsets from the root.
    #[must_use]
    pub fn offsets(&self) -> &[PitchClass] {
        &self.offsets
    }

    /// Reports whether a concrete pitch belongs to this scale.
    #[must_use]
    pub fn contains(&self, pitch: Pitch) -> bool {
        let relative = (i16::from(pitch.pitch_class().0) - i16::from(self.root.0)).rem_euclid(12);
        self.offsets
            .binary_search(&PitchClass(u8::try_from(relative).unwrap_or_default()))
            .is_ok()
    }

    /// Returns all scale pitches in an inclusive register range.
    #[must_use]
    pub fn pitches_in(&self, range: PitchRange) -> Vec<Pitch> {
        (range.min.0..=range.max.0)
            .map(Pitch)
            .filter(|pitch| self.contains(*pitch))
            .collect()
    }

    /// Transposes the scale root while preserving its interval structure.
    #[must_use]
    pub fn transpose(&self, interval: Interval) -> Self {
        Self {
            root: self.root.transpose(interval),
            offsets: self.offsets.clone(),
        }
    }
}

impl<'de> Deserialize<'de> for Scale {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct WireScale {
            root: PitchClass,
            offsets: Vec<PitchClass>,
        }

        let value = WireScale::deserialize(deserializer)?;
        let scale =
            Self::new(value.root, value.offsets.iter().copied()).map_err(de::Error::custom)?;
        if scale.offsets != value.offsets {
            return Err(de::Error::custom(
                "scale offsets must be sorted and distinct",
            ));
        }
        Ok(scale)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pitch_transposition_preserves_class_and_register() {
        let c4 = Pitch::in_register(PitchClass::new(0).unwrap(), Register::new(4)).unwrap();
        let e4 = c4.transpose(Interval::semitones(4)).unwrap();
        assert_eq!(e4.pitch_class(), PitchClass::new(4).unwrap());
        assert_eq!(e4.register(), Register::new(4));
    }

    #[test]
    fn pitch_sets_are_sorted_distinct_and_transposable() {
        let set = PitchSet::new([
            Pitch::from_semitones(7),
            Pitch::from_semitones(0),
            Pitch::from_semitones(7),
        ]);
        assert_eq!(
            set.pitches(),
            &[Pitch::from_semitones(0), Pitch::from_semitones(7)]
        );
        assert_eq!(
            set.transpose(Interval::semitones(12)).unwrap().pitches(),
            &[Pitch::from_semitones(12), Pitch::from_semitones(19)]
        );
    }

    #[test]
    fn scale_filters_an_inclusive_pitch_range() {
        let scale = Scale::new(
            PitchClass::new(0).unwrap(),
            [0, 2, 4, 5, 7, 9, 11].map(|value| PitchClass::new(value).unwrap()),
        )
        .unwrap();
        let range = PitchRange::new(Pitch::from_semitones(0), Pitch::from_semitones(12)).unwrap();
        assert_eq!(scale.pitches_in(range).len(), 8);
        assert!(scale.contains(Pitch::from_semitones(11)));
        assert!(!scale.contains(Pitch::from_semitones(10)));
    }
}
