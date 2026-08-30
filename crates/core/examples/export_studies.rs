use std::{env, error::Error, fs, path::PathBuf};

use ambiente_core::prelude::{drone_study, phase_study};

fn main() -> Result<(), Box<dyn Error>> {
    let output = env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("usage: cargo run -p ambiente-core --example export_studies -- <directory>")?;
    fs::create_dir_all(&output)?;
    for (name, document) in [("phase", phase_study()?), ("drone", drone_study()?)] {
        fs::write(
            output.join(format!("{name}.ambiente.json")),
            document.to_json()?,
        )?;
    }
    Ok(())
}
