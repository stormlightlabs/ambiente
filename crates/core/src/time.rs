//! Exact musical and absolute time values.

use std::{fmt, str::FromStr};

use num_rational::Ratio;
use serde::{Deserialize, Deserializer, Serialize, Serializer, de};
use thiserror::Error;

/// An error produced while constructing or calculating an exact time value.
#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum TimeError {
    /// A rational value had a zero denominator.
    #[error("the denominator must not be zero")]
    ZeroDenominator,
    /// A value did not use Ambiente's canonical `numerator/denominator` syntax.
    #[error("invalid rational value `{0}`; expected a reduced numerator/denominator")]
    InvalidRational(String),
    /// Exact arithmetic exceeded the supported signed 64-bit representation.
    #[error("exact time arithmetic overflowed")]
    Overflow,
    /// A value violated a domain-specific range requirement.
    #[error("{0}")]
    OutOfRange(&'static str),
}

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct Rational(Ratio<i64>);

impl Rational {
    fn new(numerator: i64, denominator: i64) -> Result<Self, TimeError> {
        Self::from_i128(i128::from(numerator), i128::from(denominator))
    }

    fn from_i128(numerator: i128, denominator: i128) -> Result<Self, TimeError> {
        if denominator == 0 {
            return Err(TimeError::ZeroDenominator);
        }
        let (mut numerator, mut denominator) = (numerator, denominator);
        if denominator < 0 {
            numerator = numerator.checked_neg().ok_or(TimeError::Overflow)?;
            denominator = denominator.checked_neg().ok_or(TimeError::Overflow)?;
        }
        let divisor = i128::try_from(gcd(numerator.unsigned_abs(), denominator.unsigned_abs()))
            .map_err(|_| TimeError::Overflow)?;
        numerator /= divisor;
        denominator /= divisor;
        let numerator = i64::try_from(numerator).map_err(|_| TimeError::Overflow)?;
        let denominator = i64::try_from(denominator).map_err(|_| TimeError::Overflow)?;
        Ok(Self(Ratio::new_raw(numerator, denominator)))
    }

    fn checked_mul(self, other: Self) -> Result<Self, TimeError> {
        Self::from_i128(
            i128::from(*self.0.numer()) * i128::from(*other.0.numer()),
            i128::from(*self.0.denom()) * i128::from(*other.0.denom()),
        )
    }

    fn checked_div(self, other: Self) -> Result<Self, TimeError> {
        if *other.0.numer() == 0 {
            return Err(TimeError::ZeroDenominator);
        }
        Self::from_i128(
            i128::from(*self.0.numer()) * i128::from(*other.0.denom()),
            i128::from(*self.0.denom()) * i128::from(*other.0.numer()),
        )
    }

    fn is_negative(self) -> bool {
        *self.0.numer() < 0
    }

    fn is_positive(self) -> bool {
        *self.0.numer() > 0
    }

    fn quantize_nonnegative(self, subdivision: Self) -> Result<Self, TimeError> {
        if self.is_negative() || !subdivision.is_positive() {
            return Err(TimeError::OutOfRange(
                "quantized values must be non-negative and subdivision must be positive",
            ));
        }

        let value_numerator = i128::from(*self.0.numer());
        let value_denominator = i128::from(*self.0.denom());
        let grid_numerator = i128::from(*subdivision.0.numer());
        let grid_denominator = i128::from(*subdivision.0.denom());
        let units_numerator = value_numerator
            .checked_mul(grid_denominator)
            .ok_or(TimeError::Overflow)?;
        let units_denominator = value_denominator
            .checked_mul(grid_numerator)
            .ok_or(TimeError::Overflow)?;
        let rounded_units = units_numerator
            .checked_add(units_denominator / 2)
            .ok_or(TimeError::Overflow)?
            / units_denominator;

        let divisor = i128::try_from(gcd(
            rounded_units.unsigned_abs(),
            grid_denominator.unsigned_abs(),
        ))
        .map_err(|_| TimeError::Overflow)?;
        Self::from_i128(
            (rounded_units / divisor)
                .checked_mul(grid_numerator)
                .ok_or(TimeError::Overflow)?,
            grid_denominator / divisor,
        )
    }
}

impl fmt::Display for Rational {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}/{}", self.0.numer(), self.0.denom())
    }
}

impl FromStr for Rational {
    type Err = TimeError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        let (numerator, denominator) = value
            .split_once('/')
            .ok_or_else(|| TimeError::InvalidRational(value.to_owned()))?;
        if numerator.is_empty() || denominator.is_empty() || denominator.starts_with('+') {
            return Err(TimeError::InvalidRational(value.to_owned()));
        }
        let numerator = numerator
            .parse::<i64>()
            .map_err(|_| TimeError::InvalidRational(value.to_owned()))?;
        let denominator = denominator
            .parse::<i64>()
            .map_err(|_| TimeError::InvalidRational(value.to_owned()))?;
        let rational = Self::new(numerator, denominator)?;
        if rational.to_string() != value {
            return Err(TimeError::InvalidRational(value.to_owned()));
        }
        Ok(rational)
    }
}

fn gcd(mut left: u128, mut right: u128) -> u128 {
    while right != 0 {
        (left, right) = (right, left % right);
    }
    left.max(1)
}

macro_rules! rational_value {
    ($name:ident, $doc:literal) => {
        #[doc = $doc]
        #[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
        pub struct $name(Rational);

        impl $name {
            /// Constructs a normalized exact value.
            ///
            /// # Errors
            ///
            /// Returns [`TimeError`] for a zero denominator or unsupported result.
            pub fn new(numerator: i64, denominator: i64) -> Result<Self, TimeError> {
                Rational::new(numerator, denominator).map(Self)
            }

            /// Returns the reduced numerator.
            #[must_use]
            pub fn numerator(self) -> i64 {
                *self.0.0.numer()
            }

            /// Returns the positive denominator.
            #[must_use]
            pub fn denominator(self) -> i64 {
                *self.0.0.denom()
            }

            /// Reports whether the value is positive.
            #[must_use]
            pub fn is_positive(self) -> bool {
                self.0.is_positive()
            }

            /// Reports whether the value is negative.
            #[must_use]
            pub fn is_negative(self) -> bool {
                self.0.is_negative()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(formatter)
            }
        }

        impl FromStr for $name {
            type Err = TimeError;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                value.parse::<Rational>().map(Self)
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

rational_value!(
    Beats,
    "An exact position or distance measured in quarter-note beats."
);
rational_value!(
    Cycles,
    "An exact cycle position or count with no implied beat length."
);

impl Beats {
    /// Rounds a non-negative beat value to the nearest subdivision, with ties upward.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a negative value, non-positive subdivision, or overflow.
    pub fn quantize(self, subdivision: Self) -> Result<Self, TimeError> {
        self.0.quantize_nonnegative(subdivision.0).map(Self)
    }
}

impl Cycles {
    /// Calculates cycle position for a beat clock with an explicit cycle length.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a non-positive cycle length or arithmetic overflow.
    pub fn at_beat_time(position: Beats, cycle_length: Beats) -> Result<Self, TimeError> {
        if !cycle_length.is_positive() {
            return Err(TimeError::OutOfRange("cycle length must be positive"));
        }
        position.0.checked_div(cycle_length.0).map(Self)
    }
}

/// Elapsed exact seconds from the piece or transport origin.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct AbsoluteTime(Rational);

impl AbsoluteTime {
    /// Constructs a non-negative absolute time.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a zero denominator, negative value, or overflow.
    pub fn new(numerator: i64, denominator: i64) -> Result<Self, TimeError> {
        let value = Rational::new(numerator, denominator)?;
        if value.is_negative() {
            return Err(TimeError::OutOfRange("absolute time must not be negative"));
        }
        Ok(Self(value))
    }

    /// Returns the exact elapsed duration from the origin.
    #[must_use]
    pub fn elapsed(self) -> AbsoluteDuration {
        AbsoluteDuration(self.0)
    }

    /// Rounds this position to the nearest absolute subdivision, with ties upward.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a zero subdivision or arithmetic overflow.
    pub fn quantize(self, subdivision: AbsoluteDuration) -> Result<Self, TimeError> {
        self.0.quantize_nonnegative(subdivision.0).map(Self)
    }
}

/// A non-negative exact duration measured in seconds.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct AbsoluteDuration(Rational);

impl AbsoluteDuration {
    /// Constructs a non-negative duration.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a zero denominator, negative value, or overflow.
    pub fn new(numerator: i64, denominator: i64) -> Result<Self, TimeError> {
        let value = Rational::new(numerator, denominator)?;
        if value.is_negative() {
            return Err(TimeError::OutOfRange(
                "absolute duration must not be negative",
            ));
        }
        Ok(Self(value))
    }

    /// Reports whether this duration is zero.
    #[must_use]
    pub fn is_zero(self) -> bool {
        !self.0.is_positive()
    }

    /// Rounds this duration to the nearest absolute subdivision, with ties upward.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a zero subdivision or arithmetic overflow.
    pub fn quantize(self, subdivision: Self) -> Result<Self, TimeError> {
        self.0.quantize_nonnegative(subdivision.0).map(Self)
    }
}

macro_rules! serde_exact_wrapper {
    ($name:ident) => {
        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(formatter)
            }
        }

        impl FromStr for $name {
            type Err = TimeError;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                let value = value.parse::<Rational>()?;
                if value.is_negative() {
                    return Err(TimeError::OutOfRange(concat!(
                        stringify!($name),
                        " must not be negative"
                    )));
                }
                Ok(Self(value))
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

serde_exact_wrapper!(AbsoluteTime);
serde_exact_wrapper!(AbsoluteDuration);

impl Cycles {
    /// Calculates cycle position for an independent absolute-time clock.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a zero cycle duration or arithmetic overflow.
    pub fn at_absolute_time(
        position: AbsoluteTime,
        cycle_duration: AbsoluteDuration,
    ) -> Result<Self, TimeError> {
        if cycle_duration.is_zero() {
            return Err(TimeError::OutOfRange("cycle duration must be positive"));
        }
        position.0.checked_div(cycle_duration.0).map(Self)
    }
}

/// A positive, exact tempo in quarter-note beats per minute.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct Tempo(Rational);

impl Tempo {
    /// Constructs a positive BPM value.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for a zero denominator, non-positive value, or overflow.
    pub fn new(numerator: i64, denominator: i64) -> Result<Self, TimeError> {
        let value = Rational::new(numerator, denominator)?;
        if !value.is_positive() {
            return Err(TimeError::OutOfRange("tempo must be positive"));
        }
        Ok(Self(value))
    }

    /// Converts a beat position or distance to exact elapsed seconds.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for negative beat distances or arithmetic overflow.
    pub fn beats_to_duration(self, beats: Beats) -> Result<AbsoluteDuration, TimeError> {
        if beats.0.is_negative() {
            return Err(TimeError::OutOfRange("beat duration must not be negative"));
        }
        let seconds = beats
            .0
            .checked_mul(Rational::new(60, 1)?)?
            .checked_div(self.0)?;
        Ok(AbsoluteDuration(seconds))
    }

    /// Converts exact elapsed seconds to a beat distance.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] when exact arithmetic overflows.
    pub fn duration_to_beats(self, duration: AbsoluteDuration) -> Result<Beats, TimeError> {
        let beats = duration
            .0
            .checked_mul(self.0)?
            .checked_div(Rational::new(60, 1)?)?;
        Ok(Beats(beats))
    }

    /// Converts a non-negative beat position to absolute elapsed time.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for negative beats or arithmetic overflow.
    pub fn beats_to_time(self, beats: Beats) -> Result<AbsoluteTime, TimeError> {
        self.beats_to_duration(beats)
            .map(|duration| AbsoluteTime(duration.0))
    }

    /// Converts absolute elapsed time to a beat position.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] when exact arithmetic overflows.
    pub fn time_to_beats(self, time: AbsoluteTime) -> Result<Beats, TimeError> {
        self.duration_to_beats(time.elapsed())
    }
}

impl fmt::Display for Tempo {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

impl Serialize for Tempo {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Tempo {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        let rational = value.parse::<Rational>().map_err(de::Error::custom)?;
        if !rational.is_positive() {
            return Err(de::Error::custom("tempo must be positive"));
        }
        Ok(Self(rational))
    }
}

/// A metric grouping expressed as beats per bar and a note-value denominator.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Meter {
    numerator: u16,
    denominator: u16,
}

impl Meter {
    /// Constructs a meter whose numerator is positive and denominator is a power of two.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] for zero numerator or a denominator that is not a power of two.
    pub fn new(numerator: u16, denominator: u16) -> Result<Self, TimeError> {
        if numerator == 0 {
            return Err(TimeError::OutOfRange("meter numerator must be positive"));
        }
        if !denominator.is_power_of_two() {
            return Err(TimeError::OutOfRange(
                "meter denominator must be a positive power of two",
            ));
        }
        Ok(Self {
            numerator,
            denominator,
        })
    }

    /// Returns the number of grouped note values per bar.
    #[must_use]
    pub fn numerator(self) -> u16 {
        self.numerator
    }

    /// Returns the note-value denominator.
    #[must_use]
    pub fn denominator(self) -> u16 {
        self.denominator
    }

    /// Returns one bar's exact length in quarter-note beats.
    ///
    /// # Errors
    ///
    /// Returns [`TimeError`] when the exact representation overflows.
    pub fn beats_per_bar(self) -> Result<Beats, TimeError> {
        Beats::new(i64::from(self.numerator) * 4, i64::from(self.denominator))
    }
}

impl<'de> Deserialize<'de> for Meter {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct WireMeter {
            numerator: u16,
            denominator: u16,
        }

        let value = WireMeter::deserialize(deserializer)?;
        Self::new(value.numerator, value.denominator).map_err(de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_rationals_are_reduced_and_strict() {
        assert_eq!(Beats::new(6, 4).unwrap().to_string(), "3/2");
        assert!("6/4".parse::<Beats>().is_err());
        assert!("1/-2".parse::<Beats>().is_err());
        assert!("1".parse::<Beats>().is_err());
    }

    #[test]
    fn quantization_rounds_to_the_nearest_exact_grid() {
        assert_eq!(
            Beats::new(1, 8)
                .unwrap()
                .quantize(Beats::new(1, 4).unwrap())
                .unwrap()
                .to_string(),
            "1/4"
        );
        assert_eq!(
            AbsoluteTime::new(13, 100)
                .unwrap()
                .quantize(AbsoluteDuration::new(1, 10).unwrap())
                .unwrap()
                .to_string(),
            "1/10"
        );
        assert!(
            Beats::new(1, 1)
                .unwrap()
                .quantize(Beats::new(0, 1).unwrap())
                .is_err()
        );
    }

    #[test]
    fn tempo_converts_four_four_time_exactly() {
        let tempo = Tempo::new(120, 1).unwrap();
        let bar = Meter::new(4, 4).unwrap().beats_per_bar().unwrap();
        assert_eq!(tempo.beats_to_duration(bar).unwrap().to_string(), "2/1");
    }

    #[test]
    fn independent_absolute_cycles_need_no_tempo() {
        let first = AbsoluteDuration::new(172, 10).unwrap();
        let second = AbsoluteDuration::new(238, 10).unwrap();
        assert_eq!(first.to_string(), "86/5");
        assert_eq!(second.to_string(), "119/5");

        let position = AbsoluteTime::new(238, 10).unwrap();
        assert_eq!(
            Cycles::at_absolute_time(position, first)
                .unwrap()
                .to_string(),
            "119/86"
        );
        assert_eq!(
            Cycles::at_absolute_time(position, second)
                .unwrap()
                .to_string(),
            "1/1"
        );
    }

    #[test]
    fn overlapping_metric_and_absolute_clocks_remain_exact() {
        let tempo = Tempo::new(90, 1).unwrap();
        let position = AbsoluteTime::new(2, 1).unwrap();
        assert_eq!(tempo.time_to_beats(position).unwrap().to_string(), "3/1");
        assert_eq!(
            Cycles::at_absolute_time(position, AbsoluteDuration::new(17, 10).unwrap())
                .unwrap()
                .to_string(),
            "20/17"
        );
    }
}
