//! First-party compositions used to test Ambiente's musical primitives.

use std::str::FromStr;

use thiserror::Error;

use crate::prelude::*;

/// A failure while constructing a bundled study from its fixed authored data.
#[derive(Debug, Error)]
pub enum StudyError {
    /// A fixed entity ID was invalid.
    #[error("invalid study entity ID: {0}")]
    Id(#[from] IdError),
    /// A fixed pattern identity was invalid.
    #[error("invalid study pattern ID: {0}")]
    PatternId(#[from] PatternIdError),
    /// Exact study timing was invalid or overflowed.
    #[error("invalid study time: {0}")]
    Time(#[from] TimeError),
    /// Authored material violated a document value constraint.
    #[error("invalid study material: {0}")]
    Value(#[from] DocumentValueError),
    /// A pattern parameter was invalid.
    #[error("invalid study pattern: {0}")]
    Pattern(#[from] PatternError),
    /// A study operation violated a document invariant.
    #[error("could not assemble study: {0}")]
    Operation(#[from] OperationError),
}

/// Builds the Phase study from one four-note absolute-time phrase.
///
/// Three voices stretch the phrase to exact 17.2, 23.8, and 31.1 second cycles.
/// Their clocks remain independent of tempo and never accumulate floating-point
/// timing error in the event engine.
///
/// # Errors
///
/// Returns [`StudyError`] if fixed authored data no longer satisfies the document model.
pub fn phase_study() -> Result<Document, StudyError> {
    let material_id = id("10000000-0000-4000-8000-000000000001")?;
    let mut phrase = Phrase::new();
    let mut document = study_document(
        "Phase Study",
        "Three copies of one small phrase move through independent, noncommensurate clocks.",
        "10000000-0000-4000-8000-000000000010",
        "10000000-0000-4000-8000-000000000011",
        0x5048_4153_4500_0001,
    )?;

    for (note_id, pitch, onset, duration, velocity) in [
        (
            "10000000-0000-4000-8000-000000000101",
            60,
            (0, 1),
            (3, 2),
            76,
        ),
        (
            "10000000-0000-4000-8000-000000000102",
            64,
            (2, 1),
            (1, 1),
            68,
        ),
        (
            "10000000-0000-4000-8000-000000000103",
            67,
            (5, 1),
            (3, 2),
            72,
        ),
        (
            "10000000-0000-4000-8000-000000000104",
            62,
            (8, 1),
            (2, 1),
            64,
        ),
    ] {
        insert_absolute_note(&mut phrase, note_id, pitch, onset, duration, velocity)?;
    }
    document.apply(Operation::AddMaterial(Material::phrase(
        material_id,
        "Four tones",
        phrase,
    )))?;

    for (voice_id, name, sound, factor, transpose, pan) in [
        (
            "10000000-0000-4000-8000-000000000201",
            "Near",
            "felt-piano",
            (43, 25),
            0,
            -32,
        ),
        (
            "10000000-0000-4000-8000-000000000202",
            "Middle",
            "glass",
            (119, 50),
            7,
            28,
        ),
        (
            "10000000-0000-4000-8000-000000000203",
            "Far",
            "soft-pluck",
            (311, 100),
            12,
            4,
        ),
    ] {
        let pattern = Pattern::material(material_id)
            .stretch(TimeScale::new(factor.0, factor.1)?)
            .transpose(Interval::semitones(transpose))
            .repeat();
        let settings = VoiceSettings::new(name, SoundRef::new(sound)?)
            .with_pattern(pattern)
            .with_parameter("gain", ParameterValue::Integer(58))
            .with_parameter("pan", ParameterValue::Integer(pan))
            .with_parameter("reverb", ParameterValue::Integer(42));
        document.apply(Operation::AddVoice(Voice::new(id(voice_id)?, settings)))?;
    }
    Ok(document)
}

/// Builds the Drone study from four sparse absolute-time phrases.
///
/// Long notes, rests, low-probability omissions and transpositions, and the
/// semantic `motion` sound control provide slow development without a continuous
/// signal type in the canonical document.
///
/// # Errors
///
/// Returns [`StudyError`] if fixed authored data no longer satisfies the document model.
pub fn drone_study() -> Result<Document, StudyError> {
    let mut document = study_document(
        "Drone Study",
        "Long tones and air move within a restrained pitch field, leaving room for silence.",
        "20000000-0000-4000-8000-000000000010",
        "20000000-0000-4000-8000-000000000011",
        0x4452_4f4e_4500_0001,
    )?;

    let voices = [
        DroneVoice {
            material_id: "20000000-0000-4000-8000-000000000101",
            voice_id: "20000000-0000-4000-8000-000000000201",
            pattern_id: "20000000-0000-4000-8000-000000000301",
            sometimes_id: "20000000-0000-4000-8000-000000000401",
            name: "Ground",
            sound: "warm-drone",
            pitch: 36,
            second_pitch: 43,
            first: (0, 55),
            second: (80, 10),
            omission: (1, 10),
            transpose: 12,
            pan: -18,
            gain: 50,
            motion: 16,
        },
        DroneVoice {
            material_id: "20000000-0000-4000-8000-000000000102",
            voice_id: "20000000-0000-4000-8000-000000000202",
            pattern_id: "20000000-0000-4000-8000-000000000302",
            sometimes_id: "20000000-0000-4000-8000-000000000402",
            name: "Fifth",
            sound: "warm-drone",
            pitch: 43,
            second_pitch: 50,
            first: (12, 42),
            second: (77, 8),
            omission: (1, 8),
            transpose: -12,
            pan: 20,
            gain: 42,
            motion: 23,
        },
        DroneVoice {
            material_id: "20000000-0000-4000-8000-000000000103",
            voice_id: "20000000-0000-4000-8000-000000000203",
            pattern_id: "20000000-0000-4000-8000-000000000303",
            sometimes_id: "20000000-0000-4000-8000-000000000403",
            name: "Halo",
            sound: "glass",
            pitch: 55,
            second_pitch: 57,
            first: (25, 20),
            second: (100, 10),
            omission: (1, 5),
            transpose: 12,
            pan: 38,
            gain: 34,
            motion: 10,
        },
        DroneVoice {
            material_id: "20000000-0000-4000-8000-000000000104",
            voice_id: "20000000-0000-4000-8000-000000000204",
            pattern_id: "20000000-0000-4000-8000-000000000304",
            sometimes_id: "20000000-0000-4000-8000-000000000404",
            name: "Air",
            sound: "air",
            pitch: 48,
            second_pitch: 50,
            first: (5, 35),
            second: (75, 12),
            omission: (1, 6),
            transpose: 0,
            pan: -35,
            gain: 30,
            motion: 30,
        },
    ];

    for voice in &voices {
        add_drone_voice(&mut document, voice)?;
    }
    Ok(document)
}

struct DroneVoice {
    material_id: &'static str,
    voice_id: &'static str,
    pattern_id: &'static str,
    sometimes_id: &'static str,
    name: &'static str,
    sound: &'static str,
    pitch: i16,
    second_pitch: i16,
    first: (i64, i64),
    second: (i64, i64),
    omission: (u32, u32),
    transpose: i16,
    pan: i64,
    gain: i64,
    motion: i64,
}

fn add_drone_voice(document: &mut Document, voice: &DroneVoice) -> Result<(), StudyError> {
    let material_id = id(voice.material_id)?;
    let mut phrase = Phrase::new();
    let first_note_id = voice.material_id.replace("-8000-", "-8001-");
    let second_note_id = voice.material_id.replace("-8000-", "-8002-");
    insert_absolute_note(
        &mut phrase,
        &first_note_id,
        voice.pitch,
        (voice.first.0, 1),
        (voice.first.1, 1),
        62,
    )?;
    insert_absolute_note(
        &mut phrase,
        &second_note_id,
        voice.second_pitch,
        (voice.second.0, 1),
        (voice.second.1, 1),
        48,
    )?;
    document.apply(Operation::AddMaterial(Material::phrase(
        material_id,
        format!("{} tones", voice.name),
        phrase,
    )))?;

    let pattern = Pattern::material(material_id)
        .omit(
            PatternId::from_str(voice.pattern_id)?,
            Probability::new(voice.omission.0, voice.omission.1)?,
        )
        .sometimes(
            PatternId::from_str(voice.sometimes_id)?,
            Probability::new(1, 7)?,
            Transformation::Transpose {
                interval: Interval::semitones(voice.transpose),
            },
        )
        .repeat();
    let settings = VoiceSettings::new(voice.name, SoundRef::new(voice.sound)?)
        .with_pattern(pattern)
        .with_parameter("gain", ParameterValue::Integer(voice.gain))
        .with_parameter("pan", ParameterValue::Integer(voice.pan))
        .with_parameter("filter_hz", ParameterValue::Integer(2_400))
        .with_parameter("reverb", ParameterValue::Integer(55))
        .with_parameter("motion", ParameterValue::Integer(voice.motion));
    document.apply(Operation::AddVoice(Voice::new(
        id(voice.voice_id)?,
        settings,
    )))?;
    Ok(())
}

fn study_document(
    title: &str,
    description: &str,
    document_id: &str,
    piece_id: &str,
    seed: u64,
) -> Result<Document, StudyError> {
    Ok(Document::new(
        id(document_id)?,
        Metadata::new()
            .with_title(title)
            .with_composer("Ambiente")
            .with_description(description),
        Seed::new(seed),
        Piece::new(
            id(piece_id)?,
            Transport::new(Tempo::new(60, 1)?, Some(Meter::new(4, 4)?)),
        ),
    ))
}

fn insert_absolute_note(
    phrase: &mut Phrase,
    note_id: &str,
    pitch: i16,
    onset: (i64, i64),
    duration: (i64, i64),
    velocity: u8,
) -> Result<(), StudyError> {
    phrase.insert_note(Note::new(
        id(note_id)?,
        Pitch::from_semitones(pitch),
        NoteTime::Absolute {
            onset: AbsoluteTime::new(onset.0, onset.1)?,
            duration: AbsoluteDuration::new(duration.0, duration.1)?,
        },
        velocity,
    )?)?;
    Ok(())
}

fn id<T>(value: &str) -> Result<T, IdError>
where
    T: FromStr<Err = IdError>,
{
    value.parse()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn phase_study_keeps_exact_noncommensurate_cycles_for_ten_minutes() {
        let document = phase_study().unwrap();
        let events = document
            .query_events(
                TimeSpan::absolute(Seconds::new(0, 1).unwrap(), Seconds::new(600, 1).unwrap())
                    .unwrap(),
            )
            .unwrap();

        assert_eq!(document.piece().materials().len(), 1);
        assert_eq!(document.piece().voices().len(), 3);
        assert!(events.len() > 250);
        assert!(events.iter().any(|event| {
            event.span().start() == TimePoint::Absolute(Seconds::new(258, 5).unwrap())
        }));
        assert!(events.iter().any(|event| {
            event.span().start() == TimePoint::Absolute(Seconds::new(357, 5).unwrap())
        }));
        assert!(events.iter().any(|event| {
            event.span().start() == TimePoint::Absolute(Seconds::new(933, 10).unwrap())
        }));

        let mut adjacent = document
            .query_events(
                TimeSpan::absolute(Seconds::new(0, 1).unwrap(), Seconds::new(300, 1).unwrap())
                    .unwrap(),
            )
            .unwrap();
        adjacent.extend(
            document
                .query_events(
                    TimeSpan::absolute(
                        Seconds::new(300, 1).unwrap(),
                        Seconds::new(600, 1).unwrap(),
                    )
                    .unwrap(),
                )
                .unwrap(),
        );
        adjacent.sort_by_key(|event| (event.span().start(), event.span().end()));
        adjacent.dedup();
        assert_eq!(adjacent, events);
    }

    #[test]
    fn bundled_documents_match_the_authored_builders() {
        assert_eq!(
            phase_study().unwrap().to_json().unwrap(),
            include_str!("../../../studies/phase.ambiente.json")
        );
        assert_eq!(
            drone_study().unwrap().to_json().unwrap(),
            include_str!("../../../studies/drone.ambiente.json")
        );
    }

    #[test]
    fn drone_study_is_sparse_long_form_and_seed_stable() {
        let document = drone_study().unwrap();
        let span =
            TimeSpan::absolute(Seconds::new(0, 1).unwrap(), Seconds::new(600, 1).unwrap()).unwrap();
        let original = document.query_events(span).unwrap();
        let variation = document
            .query_events_with_seed(span, Seed::new(0x4452_4f4e_4500_0002))
            .unwrap();

        assert_eq!(document.piece().voices().len(), 4);
        assert!((30..=60).contains(&original.len()));
        assert!((30..=60).contains(&variation.len()));
        assert_ne!(original, variation);
        assert!(
            original
                .iter()
                .any(|event| event_duration_seconds(event) >= Seconds::new(35, 1).unwrap())
        );
    }

    fn event_duration_seconds(event: &Event) -> Seconds {
        let TimePoint::Absolute(start) = event.span().start() else {
            panic!("drone events use absolute time")
        };
        let TimePoint::Absolute(end) = event.span().end() else {
            panic!("drone events use absolute time")
        };
        Seconds::new(
            end.numerator() * start.denominator() - start.numerator() * end.denominator(),
            end.denominator() * start.denominator(),
        )
        .unwrap()
    }
}
