//! Process-level tests for CLI streams and exit statuses.

use std::{fs, process::Command, time::SystemTime};

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
