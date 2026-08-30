#[cfg(not(target_arch = "wasm32"))]
use ambiente_core::prelude::Document;

const DOCUMENT: &str = include_str!("fixtures/conformance-document.json");
const QUERY: &str = include_str!("fixtures/conformance-query.json");
const EXPECTED: &str = include_str!("fixtures/conformance-events.json");

fn assert_fixture(actual: &str) {
    let actual: serde_json::Value = serde_json::from_str(actual).unwrap();
    let expected: serde_json::Value = serde_json::from_str(EXPECTED).unwrap();
    assert_eq!(actual, expected);
}

#[cfg(not(target_arch = "wasm32"))]
#[test]
fn native_runtime_matches_shared_event_fixture() {
    let document = Document::from_json(DOCUMENT).unwrap();
    let events = ambiente_wasm::query_events_json(&document, QUERY).unwrap();
    assert_fixture(&events);
}

#[cfg(target_arch = "wasm32")]
mod browser {
    use super::*;
    use ambiente_wasm::AmbienteWasm;
    use wasm_bindgen_test::wasm_bindgen_test;

    #[wasm_bindgen_test]
    fn wasm_runtime_matches_shared_event_fixture() {
        let runtime = AmbienteWasm::new(DOCUMENT).unwrap();
        let events = runtime.query_events(QUERY).unwrap();
        assert_fixture(&events);
    }
}
