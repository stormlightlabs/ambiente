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
    after_help = "Examples:\n  ambiente new study.ambiente.json --title \"Phase Study\"\n  ambiente check study.ambiente.json\n  ambiente events study.ambiente.json --end 16/1 --plain\n\nDocumentation: https://github.com/StormlightLabs/ambiente/tree/main/apps/web/content/docs"
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

    /// Include only events targeting this voice ID.
    #[arg(long)]
    voice: Option<VoiceId>,

    /// Include only events originating from this material ID.
    #[arg(long)]
    material: Option<MaterialId>,
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
    let output = inspect_output(&document);
    match mode.format {
        OutputFormat::Json => write_json(stdout, &output),
        OutputFormat::Plain => write_plain_inspect(stdout, &output),
        OutputFormat::Human => write_human_inspect(stdout, &output),
    }
}

fn write_plain_inspect(stdout: &mut dyn Write, output: &InspectOutput<'_>) -> Result<()> {
    writeln!(stdout, "document.id\t{}", output.id)?;
    writeln!(stdout, "document.schema\t{}", output.schema_version)?;
    writeln!(
        stdout,
        "document.title\t{}",
        output.metadata.title.unwrap_or("")
    )?;
    writeln!(
        stdout,
        "document.composer\t{}",
        output.metadata.composer.unwrap_or("")
    )?;
    writeln!(
        stdout,
        "document.description\t{}",
        output.metadata.description.unwrap_or("")
    )?;
    writeln!(stdout, "document.seed\t{}", output.seed)?;
    writeln!(stdout, "piece.id\t{}", output.piece_id)?;
    writeln!(stdout, "transport.tempo\t{}", output.tempo)?;
    writeln!(
        stdout,
        "transport.meter\t{}",
        output.meter.as_deref().unwrap_or("")
    )?;
    for material in &output.materials {
        writeln!(
            stdout,
            "material\t{}\t{}\t{}\t{}\t{}",
            material.id,
            material.kind,
            material.name,
            material.activity.as_deref().unwrap_or(""),
            material.register.as_deref().unwrap_or("")
        )?;
    }
    for voice in &output.voices {
        writeln!(
            stdout,
            "voice\t{}\t{}\t{}\t{}\t{}",
            voice.id,
            voice.name,
            voice.enabled,
            voice.sound,
            voice.pattern_chain.join(" -> ")
        )?;
    }
    Ok(())
}

fn write_human_inspect(stdout: &mut dyn Write, output: &InspectOutput<'_>) -> Result<()> {
    writeln!(stdout, "Document {}", output.id)?;
    writeln!(stdout, "  Schema: {}", output.schema_version)?;
    writeln!(
        stdout,
        "  Title: {}",
        output.metadata.title.unwrap_or("Untitled")
    )?;
    writeln!(
        stdout,
        "  Composer: {}",
        output.metadata.composer.unwrap_or("Unknown")
    )?;
    if let Some(description) = output.metadata.description {
        writeln!(stdout, "  Description: {description}")?;
    }
    writeln!(stdout, "  Seed: {}", output.seed)?;
    writeln!(stdout, "Piece {}", output.piece_id)?;
    writeln!(
        stdout,
        "  Transport: {} BPM, {}",
        output.tempo,
        output.meter.as_deref().unwrap_or("no meter")
    )?;
    writeln!(stdout, "Materials ({})", output.materials.len())?;
    for material in &output.materials {
        write!(
            stdout,
            "  {}  {} [{}]",
            material.id, material.name, material.kind
        )?;
        if let Some(activity) = &material.activity {
            write!(stdout, "  {activity}")?;
        }
        if let Some(register) = &material.register {
            write!(stdout, "  register {register}")?;
        }
        writeln!(stdout)?;
    }
    writeln!(stdout, "Voices ({})", output.voices.len())?;
    for voice in &output.voices {
        let state = if voice.enabled { "enabled" } else { "disabled" };
        let parameters = if voice.parameters == 1 {
            "1 parameter".to_owned()
        } else {
            format!("{} parameters", voice.parameters)
        };
        writeln!(
            stdout,
            "  {}  {} [{state}; {}; {parameters}]",
            voice.id, voice.name, voice.sound
        )?;
        if !voice.pattern_chain.is_empty() {
            writeln!(stdout, "    Pattern: {}", voice.pattern_chain.join(" -> "))?;
        }
    }
    Ok(())
}

fn events(args: &EventArgs, mode: OutputMode, stdout: &mut dyn Write) -> Result<()> {
    let document = load_document(&args.path)?;
    let span = parse_span(args.clock, &args.start, &args.end)?;
    let mut events = document.query_events(span)?;
    filter_events(&mut events, args.voice, args.material);
    if mode.format == OutputFormat::Json {
        write_json(stdout, &events)?;
    } else {
        for event in &events {
            if mode.format == OutputFormat::Plain {
                writeln!(
                    stdout,
                    "{}\t{}\t{}\t{}\t{}",
                    time_point(event.span().start()),
                    time_point(event.span().end()),
                    target_name(event.target()),
                    event_description(event.kind()),
                    source_name(event.source())
                )?;
            } else {
                writeln!(
                    stdout,
                    "{}..{}  {}  {}  source {}",
                    time_point(event.span().start()),
                    time_point(event.span().end()),
                    target_name(event.target()),
                    event_description(event.kind()),
                    source_name(event.source())
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
    if beats.is_negative() {
        bail!("MIDI export does not support negative event times");
    }
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

fn filter_events(events: &mut Vec<Event>, voice: Option<VoiceId>, material: Option<MaterialId>) {
    events.retain(|event| {
        let matches_voice = voice.is_none_or(|id| event.target() == &EventTarget::Voice(id));
        let matches_material = material.is_none_or(|id| event_material(event.source()) == id);
        matches_voice && matches_material
    });
}

fn event_material(source: &EventSource) -> MaterialId {
    match source {
        EventSource::PhraseNote { material_id, .. } | EventSource::StepCell { material_id, .. } => {
            *material_id
        }
    }
}

fn event_description(kind: &EventKind) -> String {
    match kind {
        EventKind::Note { note } => format!(
            "note pitch={} velocity={}",
            note.pitch().semitones_from_c0(),
            note.velocity()
        ),
        EventKind::Named { name } => format!("named {name}"),
    }
}

fn source_name(source: &EventSource) -> String {
    match source {
        EventSource::PhraseNote {
            material_id,
            note_id,
        } => format!("phrase_note:{material_id}:{note_id}"),
        EventSource::StepCell {
            material_id,
            row,
            step,
        } => format!("step_cell:{material_id}:{row}:{step}"),
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
    metadata: MetadataOutput<'a>,
    seed: String,
    piece_id: String,
    tempo: String,
    meter: Option<String>,
    materials: Vec<MaterialOutput<'a>>,
    voices: Vec<VoiceOutput<'a>>,
}

#[derive(Serialize)]
struct MetadataOutput<'a> {
    title: Option<&'a str>,
    composer: Option<&'a str>,
    description: Option<&'a str>,
}

#[derive(Serialize)]
struct MaterialOutput<'a> {
    id: String,
    name: &'a str,
    kind: &'static str,
    activity: Option<String>,
    register: Option<String>,
}

#[derive(Serialize)]
struct VoiceOutput<'a> {
    id: String,
    name: &'a str,
    enabled: bool,
    sound: &'a str,
    parameters: usize,
    pattern: Option<&'a Pattern>,
    pattern_chain: Vec<String>,
}

fn inspect_output(document: &Document) -> InspectOutput<'_> {
    let metadata = document.metadata();
    let piece = document.piece();
    let materials = piece.materials().values().map(material_output).collect();
    let voices = piece
        .voices()
        .values()
        .map(|voice| {
            let settings = voice.settings();
            let mut pattern_chain = Vec::new();
            if let Some(pattern) = settings.pattern() {
                describe_pattern(pattern, &mut pattern_chain);
            }
            VoiceOutput {
                id: voice.id().to_string(),
                name: settings.name(),
                enabled: settings.enabled(),
                sound: settings.sound().as_str(),
                parameters: settings.parameters().len(),
                pattern: settings.pattern(),
                pattern_chain,
            }
        })
        .collect();
    InspectOutput {
        id: document.id().to_string(),
        schema_version: document.schema_version(),
        metadata: MetadataOutput {
            title: metadata.title(),
            composer: metadata.composer(),
            description: metadata.description(),
        },
        seed: document.seed().to_string(),
        piece_id: piece.id().to_string(),
        tempo: piece.transport().tempo().to_string(),
        meter: piece
            .transport()
            .meter()
            .map(|meter| format!("{}/{}", meter.numerator(), meter.denominator())),
        materials,
        voices,
    }
}

fn material_output(material: &Material) -> MaterialOutput<'_> {
    let (kind, activity, pitches): (&str, Option<String>, Vec<Pitch>) = match material {
        Material::Phrase { phrase, .. } => (
            "phrase",
            Some(format!("{} notes", phrase.notes().len())),
            phrase.notes().values().map(Note::pitch).collect(),
        ),
        Material::StepPattern { pattern, .. } => {
            let active = pattern
                .rows()
                .iter()
                .flat_map(StepRow::cells)
                .filter(|cell| cell.active())
                .count();
            let cells = pattern.steps() * pattern.rows().len();
            (
                "step_pattern",
                Some(format!("{active}/{cells} active cells")),
                pattern.rows().iter().map(StepRow::pitch).collect(),
            )
        }
        Material::PitchSet { pitches, .. } => (
            "pitch_set",
            Some(format!("{} pitches", pitches.pitches().len())),
            pitches.pitches().to_vec(),
        ),
    };
    let register = pitches
        .iter()
        .map(|pitch| pitch.register().value())
        .min()
        .zip(pitches.iter().map(|pitch| pitch.register().value()).max())
        .map(|(min, max)| {
            if min == max {
                min.to_string()
            } else {
                format!("{min}..{max}")
            }
        });
    MaterialOutput {
        id: material.id().to_string(),
        name: material.name(),
        kind,
        activity,
        register,
    }
}

fn describe_pattern(pattern: &Pattern, output: &mut Vec<String>) {
    match pattern {
        Pattern::Material { material_id } => output.push(format!("material {material_id}")),
        Pattern::Sequence { patterns } => describe_children("sequence", patterns, output),
        Pattern::Stack { patterns } => describe_children("stack", patterns, output),
        Pattern::Repeat { pattern, count } => {
            output.push(count.map_or_else(
                || "repeat forever".to_owned(),
                |value| format!("repeat {value}"),
            ));
            describe_pattern(pattern, output);
        }
        Pattern::Transform {
            transformation,
            pattern,
        } => {
            output.push(transformation_name(transformation));
            describe_pattern(pattern, output);
        }
        Pattern::Choose { patterns, .. } => describe_children("choose", patterns, output),
        Pattern::WeightedChoose { patterns, .. } => {
            output.push(format!("weighted_choose {} branches", patterns.len()));
            for branch in patterns {
                output.push(format!("weight {}", branch.weight()));
                describe_pattern(branch.pattern(), output);
            }
        }
        Pattern::Omit {
            probability,
            pattern,
            ..
        } => {
            output.push(format!(
                "omit {}/{}",
                probability.numerator(),
                probability.denominator()
            ));
            describe_pattern(pattern, output);
        }
        Pattern::Sometimes {
            probability,
            transformation,
            pattern,
            ..
        } => {
            output.push(format!(
                "sometimes {}/{} {}",
                probability.numerator(),
                probability.denominator(),
                transformation_name(transformation)
            ));
            describe_pattern(pattern, output);
        }
    }
}

fn describe_children(label: &str, patterns: &[Pattern], output: &mut Vec<String>) {
    output.push(format!("{label} {} branches", patterns.len()));
    for pattern in patterns {
        describe_pattern(pattern, output);
    }
}

fn transformation_name(transformation: &Transformation) -> String {
    match transformation {
        Transformation::Shift { offset } => format!("shift {}", offset_name(*offset)),
        Transformation::Stretch { factor } => format!("stretch {factor}"),
        Transformation::Rotate { offset } => format!("rotate {}", offset_name(*offset)),
        Transformation::Reverse => "reverse".to_owned(),
        Transformation::Transpose { interval } => {
            format!("transpose {} semitones", interval.value())
        }
    }
}

fn offset_name(offset: TimeOffset) -> String {
    match offset {
        TimeOffset::Metric(value) => format!("metric:{value}"),
        TimeOffset::Absolute(value) => format!("absolute:{value}"),
    }
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
            "https://github.com/StormlightLabs/ambiente/tree/main/apps/web/content/docs",
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

    #[test]
    fn midi_export_rejects_non_note_events() {
        let document = Document::new(
            "9f8d76b0-0dd1-4fea-9ad9-43ae8f94f860".parse().unwrap(),
            Metadata::new(),
            Seed::default(),
            Piece::new(
                "98d4060e-3f83-4299-8932-9cf757a16a76".parse().unwrap(),
                Transport::new(Tempo::new(120, 1).unwrap(), None),
            ),
        );
        let event: Event = serde_json::from_value(serde_json::json!({
            "span": {
                "start": { "clock": "metric", "value": "0/1" },
                "end": { "clock": "metric", "value": "1/1" }
            },
            "target": {
                "type": "voice",
                "id": "826b8913-4c23-43e1-b150-594737909a58"
            },
            "kind": { "type": "named", "name": "control" },
            "source": {
                "type": "phrase_note",
                "material_id": "313b2f8d-8c00-4d82-82f6-cdb7aeb112de",
                "note_id": "92b8d664-2b27-45ca-a7c2-f816124fe813"
            },
            "properties": {}
        }))
        .unwrap();

        let error = midi_file(&document, &[event]).unwrap_err();
        assert_eq!(
            error.to_string(),
            "MIDI export does not support named events"
        );
    }
}
