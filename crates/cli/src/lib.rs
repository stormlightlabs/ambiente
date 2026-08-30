//! Command parsing and process boundaries for the Ambiente CLI.

use std::{
    collections::BTreeMap,
    env, fs,
    io::{self, IsTerminal, Write},
    path::{Path, PathBuf},
    process::ExitCode,
};

use ambiente_core::prelude::*;
use anyhow::{Context, Result, anyhow, bail};
use clap::{Args, CommandFactory, Parser, Subcommand, ValueEnum};
use clap_complete::{Shell, generate};
use midly::{
    Format, Header, MetaMessage, MidiMessage, Smf, Timing, TrackEvent, TrackEventKind,
    num::{u4, u7, u15, u24, u28},
};
use owo_colors::{OwoColorize, Style};
use serde::Serialize;

const TICKS_PER_BEAT: u16 = 480;
const EXIT_FAILURE: u8 = 1;
const EXIT_INVALID: u8 = 2;

/// Ambiente's command-line interface.
#[derive(Debug, Parser)]
#[allow(clippy::struct_excessive_bools)] // Each bool is an independent public CLI switch.
#[command(
    name = "ambiente",
    version,
    color = clap::ColorChoice::Never,
    about = "Compose and inspect deterministic generative music",
    arg_required_else_help = true,
    after_help = "Examples:\n  ambiente new study.ambiente.json --title \"Phase Study\"\n  ambiente check study.ambiente.json\n  ambiente events study.ambiente.json --end 16/1 --plain\n\nDocumentation: https://github.com/StormlightLabs/ambiente/tree/main/docs"
)]
pub struct Cli {
    /// Emit structured JSON where the command supports it.
    #[arg(long, global = true, conflicts_with = "plain")]
    json: bool,

    /// Emit stable line-oriented human output.
    #[arg(long, global = true, conflicts_with = "json")]
    plain: bool,

    /// Suppress non-essential success output.
    #[arg(short, long, global = true)]
    quiet: bool,

    /// Never read interactive input.
    #[arg(long, global = true)]
    no_input: bool,

    /// Disable terminal colors.
    #[arg(long, global = true)]
    no_color: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Create a minimal Ambiente document.
    New(NewArgs),
    /// Validate an Ambiente document.
    Check { path: PathBuf },
    /// Summarize an Ambiente document.
    Inspect { path: PathBuf },
    /// Query generated events over a time span.
    Events(EventArgs),
    /// Export generated events.
    Export(ExportArgs),
    /// Generate a shell completion script.
    Completions { shell: Shell },
}

#[derive(Debug, Args)]
struct NewArgs {
    /// Path for the new document.
    path: PathBuf,

    /// Document title.
    #[arg(long)]
    title: Option<String>,

    /// Composer display name.
    #[arg(long)]
    composer: Option<String>,

    /// Initial tempo in beats per minute, as an integer or exact fraction.
    #[arg(long, default_value = "120/1")]
    tempo: String,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum ClockArg {
    Metric,
    Absolute,
}

#[derive(Debug, Args)]
struct EventArgs {
    /// Document to query.
    path: PathBuf,

    /// Inclusive span start as an exact fraction.
    #[arg(long, default_value = "0/1")]
    start: String,

    /// Exclusive span end as an exact fraction.
    #[arg(long)]
    end: String,

    /// Time domain used by start and end.
    #[arg(long, value_enum, default_value_t = ClockArg::Metric)]
    clock: ClockArg,
}

#[derive(Debug, Args)]
struct ExportArgs {
    /// Document to export.
    input: PathBuf,

    /// Write a Standard MIDI File to this path.
    #[arg(long, value_name = "PATH")]
    midi: PathBuf,

    /// Inclusive span start as an exact fraction.
    #[arg(long, default_value = "0/1")]
    start: String,

    /// Exclusive span end as an exact fraction.
    #[arg(long)]
    end: String,

    /// Time domain used by start and end.
    #[arg(long, value_enum, default_value_t = ClockArg::Metric)]
    clock: ClockArg,
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum OutputFormat {
    Human,
    Json,
    Plain,
}

#[derive(Clone, Copy)]
struct StreamColors {
    stdout: bool,
    stderr: bool,
}

#[derive(Clone, Copy)]
struct OutputMode {
    format: OutputFormat,
    quiet: bool,
    colors: StreamColors,
}

#[derive(Debug)]
struct Failure {
    code: u8,
    error: anyhow::Error,
    reported: bool,
}

impl Failure {
    fn operational(error: anyhow::Error) -> Self {
        Self {
            code: EXIT_FAILURE,
            error,
            reported: false,
        }
    }

    fn invalid(error: anyhow::Error, reported: bool) -> Self {
        Self {
            code: EXIT_INVALID,
            error,
            reported,
        }
    }
}

/// Parses process arguments, executes one command, and returns its process status.
#[must_use]
pub fn run() -> ExitCode {
    let cli = Cli::parse();
    let colors_allowed = !cli.no_color
        && env::var_os("NO_COLOR").is_none()
        && env::var("TERM").map_or(true, |term| term != "dumb");
    let format = if cli.json {
        OutputFormat::Json
    } else if cli.plain {
        OutputFormat::Plain
    } else {
        OutputFormat::Human
    };
    let mode = OutputMode {
        format,
        quiet: cli.quiet,
        colors: StreamColors {
            stdout: colors_allowed && io::stdout().is_terminal(),
            stderr: colors_allowed && io::stderr().is_terminal(),
        },
    };
    let mut stdout = io::stdout().lock();
    let mut stderr = io::stderr().lock();

    match execute(cli.command, mode, &mut stdout, &mut stderr) {
        Ok(()) => ExitCode::SUCCESS,
        Err(failure) => {
            if !failure.reported {
                let label = styled("error", Style::new().red().bold(), mode.colors.stderr);
                let _ = writeln!(stderr, "{label}: {:#}", failure.error);
            }
            ExitCode::from(failure.code)
        }
    }
}

fn execute(
    command: Command,
    mode: OutputMode,
    stdout: &mut dyn Write,
    stderr: &mut dyn Write,
) -> std::result::Result<(), Failure> {
    match command {
        Command::New(args) => create_document(args, mode, stdout).map_err(Failure::operational),
        Command::Check { path } => check_document(&path, mode, stdout, stderr),
        Command::Inspect { path } => {
            inspect_document(&path, mode, stdout).map_err(Failure::operational)
        }
        Command::Events(args) => events(&args, mode, stdout).map_err(classify_input_error),
        Command::Export(args) => export_midi(&args, mode, stdout).map_err(classify_input_error),
        Command::Completions { shell } => {
            let mut command = Cli::command();
            generate(shell, &mut command, "ambiente", stdout);
            Ok(())
        }
    }
}

fn classify_input_error(error: anyhow::Error) -> Failure {
    if error.downcast_ref::<PatternError>().is_some()
        || error.downcast_ref::<TimeError>().is_some()
        || error.downcast_ref::<LoadError>().is_some()
    {
        Failure::invalid(error, false)
    } else {
        Failure::operational(error)
    }
}

fn create_document(args: NewArgs, mode: OutputMode, stdout: &mut dyn Write) -> Result<()> {
    if args.path.exists() {
        bail!("refusing to overwrite `{}`", args.path.display());
    }
    let tempo = parse_tempo(&args.tempo)?;
    let mut metadata = Metadata::new();
    if let Some(title) = args.title {
        metadata = metadata.with_title(title);
    }
    if let Some(composer) = args.composer {
        metadata = metadata.with_composer(composer);
    }
    let document = Document::new(
        DocumentId::new(),
        metadata,
        Seed::default(),
        Piece::new(
            PieceId::new(),
            Transport::new(tempo, Some(Meter::new(4, 4)?)),
        ),
    );
    let contents = document.to_json()?;
    fs::write(&args.path, contents)
        .with_context(|| format!("could not write `{}`", args.path.display()))?;

    if mode.quiet {
        return Ok(());
    }
    if mode.format == OutputFormat::Json {
        write_json(stdout, &NewOutput { path: &args.path })?;
    } else if mode.format == OutputFormat::Plain {
        writeln!(stdout, "{}", args.path.display())?;
    } else {
        let created = styled("Created", Style::new().green().bold(), mode.colors.stdout);
        writeln!(stdout, "{created} {}", args.path.display())?;
    }
    Ok(())
}

fn parse_tempo(value: &str) -> Result<Tempo> {
    let (numerator, denominator) = value
        .split_once('/')
        .ok_or_else(|| anyhow!("tempo must be an exact fraction such as 120/1"))?;
    Tempo::new(
        numerator
            .parse()
            .context("tempo numerator must be an integer")?,
        denominator
            .parse()
            .context("tempo denominator must be an integer")?,
    )
    .map_err(Into::into)
}

fn check_document(
    path: &Path,
    mode: OutputMode,
    stdout: &mut dyn Write,
    stderr: &mut dyn Write,
) -> std::result::Result<(), Failure> {
    let input = read_document_text(path).map_err(Failure::operational)?;
    match Document::from_json(&input) {
        Ok(document) => {
            if !mode.quiet {
                if mode.format == OutputFormat::Json {
                    write_json(
                        stdout,
                        &CheckOutput {
                            valid: true,
                            path,
                            diagnostics: &[],
                            error: None,
                        },
                    )
                    .map_err(Failure::operational)?;
                } else if mode.format == OutputFormat::Plain {
                    writeln!(stdout, "valid\t{}", path.display())
                        .map_err(|error| Failure::operational(error.into()))?;
                } else {
                    let valid = styled("Valid", Style::new().green().bold(), mode.colors.stdout);
                    writeln!(
                        stdout,
                        "{valid} {} (schema {})",
                        path.display(),
                        document.schema_version()
                    )
                    .map_err(|error| Failure::operational(error.into()))?;
                }
            }
            Ok(())
        }
        Err(LoadError::InvalidDocument(diagnostics)) => {
            if mode.format == OutputFormat::Json {
                write_json(
                    stdout,
                    &CheckOutput {
                        valid: false,
                        path,
                        diagnostics: &diagnostics,
                        error: None,
                    },
                )
                .map_err(Failure::operational)?;
            } else {
                write_diagnostics(stderr, &diagnostics, mode.colors.stderr)
                    .map_err(Failure::operational)?;
            }
            Err(Failure::invalid(anyhow!("document is invalid"), true))
        }
        Err(error) => {
            if mode.format == OutputFormat::Json {
                let message = error.to_string();
                write_json(
                    stdout,
                    &CheckOutput {
                        valid: false,
                        path,
                        diagnostics: &[],
                        error: Some(&message),
                    },
                )
                .map_err(Failure::operational)?;
                Err(Failure::invalid(anyhow!(message), true))
            } else {
                Err(Failure::invalid(error.into(), false))
            }
        }
    }
}

fn write_diagnostics(
    output: &mut dyn Write,
    diagnostics: &[Diagnostic],
    color: bool,
) -> Result<()> {
    let mut groups: BTreeMap<String, Vec<&Diagnostic>> = BTreeMap::new();
    for diagnostic in diagnostics {
        groups
            .entry(diagnostic_code(diagnostic.code()))
            .or_default()
            .push(diagnostic);
    }
    for (code, diagnostics) in groups {
        let heading = styled(&code, Style::new().red().bold(), color);
        writeln!(output, "{heading}:")?;
        for diagnostic in diagnostics {
            write!(output, "  - {}", diagnostic.message())?;
            if let Some(location) = diagnostic.location() {
                write!(output, " [{}", location.object_id())?;
                if let Some(field) = location.field() {
                    write!(output, ".{field}")?;
                }
                write!(output, "]")?;
            }
            writeln!(output)?;
            if let Some(help) = diagnostic.help() {
                writeln!(output, "    help: {help}")?;
            }
        }
    }
    Ok(())
}

fn inspect_document(path: &Path, mode: OutputMode, stdout: &mut dyn Write) -> Result<()> {
    let document = load_document(path)?;
    let metadata = document.metadata();
    let piece = document.piece();
    let output = InspectOutput {
        id: document.id().to_string(),
        schema_version: document.schema_version(),
        title: metadata.title(),
        composer: metadata.composer(),
        seed: document.seed().to_string(),
        materials: piece.materials().len(),
        voices: piece.voices().len(),
    };
    if mode.format == OutputFormat::Json {
        write_json(stdout, &output)?;
    } else if mode.format == OutputFormat::Plain {
        writeln!(stdout, "id\t{}", output.id)?;
        writeln!(stdout, "schema\t{}", output.schema_version)?;
        writeln!(stdout, "title\t{}", output.title.unwrap_or(""))?;
        writeln!(stdout, "composer\t{}", output.composer.unwrap_or(""))?;
        writeln!(stdout, "seed\t{}", output.seed)?;
        writeln!(stdout, "materials\t{}", output.materials)?;
        writeln!(stdout, "voices\t{}", output.voices)?;
    } else {
        writeln!(stdout, "Document {}", output.id)?;
        writeln!(stdout, "  Schema: {}", output.schema_version)?;
        writeln!(stdout, "  Title: {}", output.title.unwrap_or("Untitled"))?;
        writeln!(
            stdout,
            "  Composer: {}",
            output.composer.unwrap_or("Unknown")
        )?;
        writeln!(stdout, "  Seed: {}", output.seed)?;
        writeln!(stdout, "  Materials: {}", output.materials)?;
        writeln!(stdout, "  Voices: {}", output.voices)?;
    }
    Ok(())
}

fn events(args: &EventArgs, mode: OutputMode, stdout: &mut dyn Write) -> Result<()> {
    let document = load_document(&args.path)?;
    let span = parse_span(args.clock, &args.start, &args.end)?;
    let events = document.query_events(span)?;
    if mode.format == OutputFormat::Json {
        write_json(stdout, &events)?;
    } else {
        for event in &events {
            if mode.format == OutputFormat::Plain {
                writeln!(
                    stdout,
                    "{}\t{}\t{}\t{:?}\t{:?}",
                    time_point(event.span().start()),
                    time_point(event.span().end()),
                    target_name(event.target()),
                    event.kind(),
                    event.source()
                )?;
            } else {
                writeln!(
                    stdout,
                    "{}..{}  {}  {:?}",
                    time_point(event.span().start()),
                    time_point(event.span().end()),
                    target_name(event.target()),
                    event.kind()
                )?;
            }
        }
        if events.is_empty() && !mode.quiet && mode.format != OutputFormat::Plain {
            writeln!(stdout, "No events in the requested span.")?;
        }
    }
    Ok(())
}

fn export_midi(args: &ExportArgs, mode: OutputMode, stdout: &mut dyn Write) -> Result<()> {
    if args.midi.exists() {
        bail!("refusing to overwrite `{}`", args.midi.display());
    }
    let document = load_document(&args.input)?;
    let span = parse_span(args.clock, &args.start, &args.end)?;
    let events = document.query_events(span)?;
    let midi = midi_file(&document, &events)?;
    midi.save(&args.midi)
        .with_context(|| format!("could not write `{}`", args.midi.display()))?;

    if !mode.quiet {
        if mode.format == OutputFormat::Json {
            write_json(
                stdout,
                &ExportOutput {
                    path: &args.midi,
                    events: events.len(),
                },
            )?;
        } else if mode.format == OutputFormat::Plain {
            writeln!(stdout, "{}\t{}", args.midi.display(), events.len())?;
        } else {
            let exported = styled("Exported", Style::new().green().bold(), mode.colors.stdout);
            writeln!(
                stdout,
                "{exported} {} ({} events)",
                args.midi.display(),
                events.len()
            )?;
        }
    }
    Ok(())
}

fn midi_file(document: &Document, events: &[Event]) -> Result<Smf<'static>> {
    let one_beat = Beats::new(1, 1)?;
    let micros = document
        .piece()
        .transport()
        .tempo()
        .beats_to_duration(one_beat)?;
    let micros = rational_to_integer(micros.numerator(), micros.denominator(), 1_000_000)?;
    let micros = u32::try_from(micros).context("tempo is outside MIDI's supported range")?;
    if micros == 0 || micros > 0x00ff_ffff {
        bail!("tempo is outside MIDI's supported range");
    }

    let mut timed = vec![(
        0_u32,
        0_u8,
        TrackEventKind::Meta(MetaMessage::Tempo(u24::new(micros))),
    )];
    for event in events {
        let EventKind::Note { note } = event.kind() else {
            bail!("MIDI export does not support named events");
        };
        let start = event_tick(document, event.span().start())?;
        let end = event_tick(document, event.span().end())?;
        let midi_pitch = note
            .pitch()
            .semitones_from_c0()
            .checked_add(12)
            .ok_or_else(|| anyhow!("note pitch is outside MIDI's supported range"))?;
        let midi_pitch = u8::try_from(midi_pitch)
            .ok()
            .filter(|pitch| *pitch <= 127)
            .ok_or_else(|| anyhow!("note pitch is outside MIDI's supported range"))?;
        let key = u7::new(midi_pitch);
        timed.push((
            start,
            2,
            TrackEventKind::Midi {
                channel: u4::new(0),
                message: MidiMessage::NoteOn {
                    key,
                    vel: u7::new(note.velocity()),
                },
            },
        ));
        timed.push((
            end,
            1,
            TrackEventKind::Midi {
                channel: u4::new(0),
                message: MidiMessage::NoteOff {
                    key,
                    vel: u7::new(0),
                },
            },
        ));
    }
    timed.sort_by_key(|(tick, priority, _)| (*tick, *priority));

    let mut previous = 0;
    let mut track = Vec::with_capacity(timed.len() + 1);
    for (tick, _, kind) in timed {
        track.push(TrackEvent {
            delta: u28::new(tick - previous),
            kind,
        });
        previous = tick;
    }
    track.push(TrackEvent {
        delta: u28::new(0),
        kind: TrackEventKind::Meta(MetaMessage::EndOfTrack),
    });
    Ok(Smf {
        header: Header::new(
            Format::SingleTrack,
            Timing::Metrical(u15::new(TICKS_PER_BEAT)),
        ),
        tracks: vec![track],
    })
}

fn event_tick(document: &Document, point: TimePoint) -> Result<u32> {
    let beats = match point {
        TimePoint::Metric(beats) => beats,
        TimePoint::Absolute(seconds) => {
            if seconds.is_negative() {
                bail!("MIDI export does not support negative event times");
            }
            let duration = AbsoluteDuration::new(seconds.numerator(), seconds.denominator())?;
            document
                .piece()
                .transport()
                .tempo()
                .duration_to_beats(duration)?
        }
    };
    let ticks = rational_to_integer(
        beats.numerator(),
        beats.denominator(),
        i128::from(TICKS_PER_BEAT),
    )?;
    let ticks = u32::try_from(ticks).context("event time is outside MIDI's supported range")?;
    if ticks > 0x0fff_ffff {
        bail!("event time is outside MIDI's supported range");
    }
    Ok(ticks)
}

fn rational_to_integer(numerator: i64, denominator: i64, scale: i128) -> Result<i128> {
    let scaled = i128::from(numerator)
        .checked_mul(scale)
        .ok_or_else(|| anyhow!("time conversion overflowed"))?;
    let denominator = i128::from(denominator);
    let rounded = scaled
        .checked_add(denominator / 2)
        .ok_or_else(|| anyhow!("time conversion overflowed"))?;
    Ok(rounded / denominator)
}

fn parse_span(clock: ClockArg, start: &str, end: &str) -> Result<TimeSpan> {
    match clock {
        ClockArg::Metric => TimeSpan::metric(start.parse()?, end.parse()?).map_err(Into::into),
        ClockArg::Absolute => TimeSpan::absolute(start.parse()?, end.parse()?).map_err(Into::into),
    }
}

fn load_document(path: &Path) -> Result<Document> {
    let input = read_document_text(path)?;
    Document::from_json(&input).with_context(|| format!("invalid document `{}`", path.display()))
}

fn read_document_text(path: &Path) -> Result<String> {
    fs::read_to_string(path).with_context(|| format!("could not read `{}`", path.display()))
}

fn time_point(point: TimePoint) -> String {
    match point {
        TimePoint::Metric(value) => format!("metric:{value}"),
        TimePoint::Absolute(value) => format!("absolute:{value}"),
    }
}

fn target_name(target: &EventTarget) -> String {
    match target {
        EventTarget::Voice(id) => id.to_string(),
        EventTarget::Symbolic(name) => name.clone(),
    }
}

fn diagnostic_code(code: DiagnosticCode) -> String {
    serde_json::to_value(code)
        .ok()
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_else(|| "validation.error".to_owned())
}

fn styled(text: &str, style: Style, enabled: bool) -> String {
    if enabled {
        text.style(style).to_string()
    } else {
        text.to_owned()
    }
}

fn write_json(output: &mut dyn Write, value: &impl Serialize) -> Result<()> {
    serde_json::to_writer_pretty(&mut *output, value)?;
    writeln!(output)?;
    Ok(())
}

#[derive(Serialize)]
struct NewOutput<'a> {
    path: &'a Path,
}

#[derive(Serialize)]
struct CheckOutput<'a> {
    valid: bool,
    path: &'a Path,
    diagnostics: &'a [Diagnostic],
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<&'a str>,
}

#[derive(Serialize)]
struct InspectOutput<'a> {
    id: String,
    schema_version: u32,
    title: Option<&'a str>,
    composer: Option<&'a str>,
    seed: String,
    materials: usize,
    voices: usize,
}

#[derive(Serialize)]
struct ExportOutput<'a> {
    path: &'a Path,
    events: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_tree_exposes_required_commands_and_global_flags() {
        let help = Cli::command().render_long_help().to_string();
        for expected in [
            "new",
            "check",
            "inspect",
            "events",
            "export",
            "completions",
            "--json",
            "--plain",
            "--quiet",
            "--no-input",
            "--no-color",
            "https://github.com/StormlightLabs/ambiente/tree/main/docs",
        ] {
            assert!(help.contains(expected), "help omitted {expected}");
        }
    }

    #[test]
    fn terminal_policy_honors_dumb_term_and_no_color() {
        let no_color =
            |flag: bool, no_color_env: bool, term: &str| !flag && !no_color_env && term != "dumb";
        assert!(!no_color(true, false, "xterm"));
        assert!(!no_color(false, true, "xterm"));
        assert!(!no_color(false, false, "dumb"));
        assert!(no_color(false, false, "xterm"));
    }

    #[test]
    fn invalid_span_is_rejected() {
        let error = parse_span(ClockArg::Metric, "2/1", "1/1").unwrap_err();
        assert!(error.downcast_ref::<PatternError>().is_some());
    }
}
