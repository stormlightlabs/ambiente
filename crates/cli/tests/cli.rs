//! Process-level tests for CLI streams and exit statuses.

use std::{fs, process::Command, str::FromStr, time::SystemTime};

use ambiente_core::prelude::*;

fn ambiente() -> Command {
    Command::new(env!("CARGO_BIN_EXE_ambiente"))
}

fn temporary_document(name: &str) -> std::path::PathBuf {
    let nonce = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "ambiente-cli-{name}-{}-{nonce}.json",
        std::process::id()
    ))
}

fn fixture_document(path: &std::path::Path) -> (VoiceId, MaterialId) {
    let material_id = MaterialId::from_str("313b2f8d-8c00-4d82-82f6-cdb7aeb112de").unwrap();
    let voice_id = VoiceId::from_str("826b8913-4c23-43e1-b150-594737909a58").unwrap();
    let mut document = Document::new(
        DocumentId::from_str("9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860").unwrap(),
        Metadata::new()
            .with_title("CLI Study")
            .with_composer("Ambiente")
            .with_description("A deterministic command fixture."),
        Seed::new(42),
        Piece::new(
            PieceId::from_str("98d4060e-3f83-4299-8932-9cf757a16a76").unwrap(),
            Transport::new(Tempo::new(120, 1).unwrap(), Some(Meter::new(4, 4).unwrap())),
        ),
    );
    document
        .apply(Operation::AddMaterial(Material::step_pattern(
            material_id,
            "Pulse",
            StepPattern::new(
                4,
                Beats::new(1, 1).unwrap(),
                [Pitch::from_semitones(60), Pitch::from_semitones(67)],
            )
            .unwrap(),
        )))
        .unwrap();
    document
        .apply(Operation::UpdateMatrixCell {
            material_id,
            row: 0,
            step: 0,
            active: true,
        })
        .unwrap();
    document
        .apply(Operation::UpdateMatrixCell {
            material_id,
            row: 1,
            step: 2,
            active: true,
        })
        .unwrap();
    document
        .apply(Operation::AddVoice(Voice::new(
            voice_id,
            VoiceSettings::new("Pulse Voice", SoundRef::new("soft-pluck").unwrap())
                .with_pattern(Pattern::material(material_id).repeat()),
        )))
        .unwrap();
    fs::write(path, document.to_json().unwrap()).unwrap();
    (voice_id, material_id)
}

#[test]
fn check_separates_machine_output_from_diagnostics() {
    let path = temporary_document("check");
    let created = ambiente()
        .args(["new", path.to_str().unwrap(), "--title", "Study", "--quiet"])
        .output()
        .unwrap();
    assert!(created.status.success());
    assert!(created.stdout.is_empty());
    assert!(created.stderr.is_empty());

    let checked = ambiente()
        .args(["check", path.to_str().unwrap(), "--json"])
        .output()
        .unwrap();
    assert!(checked.status.success());
    assert!(checked.stderr.is_empty());
    let output: serde_json::Value = serde_json::from_slice(&checked.stdout).unwrap();
    assert_eq!(output["valid"], true);

    let invalid = fs::read_to_string(&path)
        .unwrap()
        .replace("\"title\": \"Study\"", "\"title\": \"\"");
    fs::write(&path, invalid).unwrap();
    let checked = ambiente()
        .env("NO_COLOR", "1")
        .args(["check", path.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(checked.status.code(), Some(2));
    assert!(checked.stdout.is_empty());
    let diagnostics = String::from_utf8(checked.stderr).unwrap();
    assert!(diagnostics.contains("value.empty:"));
    assert!(diagnostics.contains("help: remove title or provide text"));
    assert!(!diagnostics.contains("\u{1b}["));

    fs::remove_file(path).unwrap();
}

#[test]
fn inspect_explains_materials_voices_and_pattern_chains() {
    let path = temporary_document("inspect");
    fixture_document(&path);

    let inspected = ambiente()
        .args(["inspect", path.to_str().unwrap(), "--json"])
        .output()
        .unwrap();
    assert!(inspected.status.success());
    assert!(inspected.stderr.is_empty());
    let output: serde_json::Value = serde_json::from_slice(&inspected.stdout).unwrap();
    assert_eq!(output["metadata"]["title"], "CLI Study");
    assert_eq!(output["materials"][0]["activity"], "2/8 active cells");
    assert_eq!(output["materials"][0]["register"], "5");
    assert_eq!(output["voices"][0]["sound"], "soft-pluck");
    assert_eq!(output["voices"][0]["pattern_chain"][0], "repeat forever");
    assert!(
        output["voices"][0]["pattern_chain"][1]
            .as_str()
            .unwrap()
            .starts_with("material ")
    );

    fs::remove_file(path).unwrap();
}

#[test]
fn events_support_stable_output_and_semantic_filters() {
    let path = temporary_document("events");
    let (voice_id, material_id) = fixture_document(&path);

    let queried = ambiente()
        .args([
            "events",
            path.to_str().unwrap(),
            "--end",
            "8/1",
            "--plain",
            "--voice",
            &voice_id.to_string(),
            "--material",
            &material_id.to_string(),
        ])
        .output()
        .unwrap();
    assert!(queried.status.success());
    assert!(queried.stderr.is_empty());
    let output = String::from_utf8(queried.stdout).unwrap();
    assert_eq!(output.lines().count(), 4);
    assert!(output.contains("note pitch=60 velocity=100"));
    assert!(output.contains("step_cell:"));

    let absent_voice = VoiceId::new();
    let filtered = ambiente()
        .args([
            "events",
            path.to_str().unwrap(),
            "--end",
            "8/1",
            "--json",
            "--voice",
            &absent_voice.to_string(),
        ])
        .output()
        .unwrap();
    assert!(filtered.status.success());
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&filtered.stdout).unwrap(),
        serde_json::json!([])
    );

    fs::remove_file(path).unwrap();
}

#[test]
fn midi_export_is_deterministic() {
    let input = temporary_document("midi-input");
    let first = temporary_document("midi-first").with_extension("mid");
    let second = temporary_document("midi-second").with_extension("mid");
    fixture_document(&input);

    for output in [&first, &second] {
        let exported = ambiente()
            .args([
                "export",
                input.to_str().unwrap(),
                "--midi",
                output.to_str().unwrap(),
                "--end",
                "8/1",
                "--quiet",
            ])
            .output()
            .unwrap();
        assert!(exported.status.success());
        assert!(exported.stdout.is_empty());
        assert!(exported.stderr.is_empty());
    }
    assert_eq!(fs::read(&first).unwrap(), fs::read(&second).unwrap());

    fs::remove_file(input).unwrap();
    fs::remove_file(first).unwrap();
    fs::remove_file(second).unwrap();
}
