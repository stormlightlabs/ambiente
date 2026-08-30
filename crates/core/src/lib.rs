//! Canonical musical state and event generation for Ambiente.

mod document;
mod pattern;
mod theory;
mod time;

pub mod prelude {
    pub use super::document::*;
    pub use super::pattern::*;
    pub use super::theory::*;
    pub use super::time::*;
}
