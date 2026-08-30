//! Canonical musical state and event generation for Ambiente.

mod document;
mod pattern;
mod studies;
mod theory;
mod time;

pub mod prelude {
    pub use super::document::*;
    pub use super::pattern::*;
    pub use super::studies::*;
    pub use super::theory::*;
    pub use super::time::*;
}
