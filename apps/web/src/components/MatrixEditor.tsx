import { For, Show } from 'solid-js';

import type { ApplicationMaterial, DocumentOperation } from '../application/facade';
import { pitchName } from './PianoKeyboard';

type StepPatternMaterial = Extract<ApplicationMaterial, { type: 'step_pattern' }>;

/** State and canonical edit callback for the Studio matrix editor. */
export type MatrixEditorProps = Readonly<{
	material: StepPatternMaterial | undefined;
	onOperation: (operation: DocumentOperation) => boolean;
	positionSeconds: number;
	tempo: string;
}>;

/** Edits and displays one canonical StepPattern with a transport playhead. */
export function MatrixEditor(props: MatrixEditorProps) {
	const activeStep = () => {
		if (!props.material) return -1;
		const subdivision = exactToNumber(props.material.pattern.subdivision);
		const tempo = exactToNumber(props.tempo);
		return Math.floor((props.positionSeconds * tempo) / 60 / subdivision) % props.material.pattern.steps;
	};

	function configure(changes: Readonly<{ pitches?: readonly number[]; steps?: number; subdivision?: string }>) {
		const material = props.material;
		if (!material) return;
		props.onOperation({
			kind: 'configure_step_pattern',
			payload: {
				material_id: material.id,
				pitches: changes.pitches ?? material.pattern.rows.map((row) => row.pitch),
				steps: changes.steps ?? material.pattern.steps,
				subdivision: changes.subdivision ?? material.pattern.subdivision
			}
		});
	}

	return (
		<Show
			when={props.material}
			fallback={
				<section class="matrix-editor matrix-editor--empty">
					<h2>No matrix selected</h2>
					<p>Add a matrix or select one from Materials.</p>
				</section>
			}>
			{(material) => (
				<section class="matrix-editor" aria-label={`${material().name} matrix editor`}>
					<header class="matrix-editor__header">
						<div>
							<p class="kicker">Matrix</p>
							<h2>{material().name}</h2>
						</div>
						<div class="matrix-editor__settings">
							<label>
								<span>Steps</span>
								<select
									aria-label="Matrix step count"
									value={material().pattern.steps}
									onChange={(event) => configure({ steps: Number(event.currentTarget.value) })}>
									<For each={[4, 8, 12, 16, 24, 32]}>{(steps) => <option value={steps}>{steps}</option>}</For>
								</select>
							</label>
							<label>
								<span>Subdivision</span>
								<select
									aria-label="Matrix subdivision"
									value={material().pattern.subdivision}
									onChange={(event) => configure({ subdivision: event.currentTarget.value })}>
									<option value="1/1">1/4 note</option>
									<option value="1/2">1/8 note</option>
									<option value="1/4">1/16 note</option>
									<option value="1/8">1/32 note</option>
								</select>
							</label>
						</div>
					</header>

					<div class="matrix-editor__scroll">
						<div class="matrix-grid" style={`--matrix-steps: ${material().pattern.steps}`}>
							<div class="matrix-grid__corner" aria-hidden="true" />
							<div class="matrix-grid__steps" aria-hidden="true">
								<For each={Array.from({ length: material().pattern.steps })}>
									{(_, step) => <span classList={{ 'is-current': step() === activeStep() }}>{step() + 1}</span>}
								</For>
							</div>
							<For each={material().pattern.rows}>
								{(row, rowIndex) => (
									<>
										<label class="matrix-grid__pitch">
											<span class="sr-only">Pitch row {rowIndex() + 1}</span>
											<input
												type="number"
												min="0"
												max="127"
												value={row.pitch}
												title={pitchName(row.pitch)}
												onChange={(event) => {
													const pitches = material().pattern.rows.map((item) => item.pitch);
													pitches[rowIndex()] = Number(event.currentTarget.value);
													configure({ pitches });
												}}
											/>
											<small>{pitchName(row.pitch)}</small>
										</label>
										<div class="matrix-grid__row">
											<For each={row.cells}>
												{(cell, step) => (
													<button
														type="button"
														classList={{ 'is-active': cell.active, 'is-current': step() === activeStep() }}
														aria-label={`${pitchName(row.pitch)}, step ${step() + 1}`}
														aria-pressed={cell.active}
														onClick={() =>
															props.onOperation({
																kind: 'update_matrix_cell',
																payload: {
																	active: !cell.active,
																	material_id: material().id,
																	row: rowIndex(),
																	step: step()
																}
															})
														}
													/>
												)}
											</For>
										</div>
									</>
								)}
							</For>
						</div>
					</div>
					<footer class="matrix-editor__rows">
						<button
							type="button"
							disabled={material().pattern.rows.length <= 1}
							onClick={() =>
								configure({
									pitches: material()
										.pattern.rows.slice(0, -1)
										.map((row) => row.pitch)
								})
							}>
							Remove row
						</button>
						<button
							type="button"
							disabled={material().pattern.rows.length >= 16}
							onClick={() => {
								const pitches = material().pattern.rows.map((row) => row.pitch);
								configure({ pitches: [...pitches, Math.max(0, (pitches.at(-1) ?? 60) - 2)] });
							}}>
							Add row
						</button>
					</footer>
				</section>
			)}
		</Show>
	);
}

function exactToNumber(value: string): number {
	const [numerator, denominator] = value.split('/').map(Number);
	return denominator ? numerator! / denominator : Number.NaN;
}
