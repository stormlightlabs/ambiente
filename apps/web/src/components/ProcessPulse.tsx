import { createSignal, For } from "solid-js";

const steps = [0, 1, 0, 1, 1, 0, 0, 1];

/** Small Solid interaction embedded in the interactive documentation page. */
export function ProcessPulse() {
  const [offset, setOffset] = createSignal(0);

  return (
    <figure class="process-pulse" aria-label="Rotating step pattern">
      <div class="process-pulse__steps" aria-hidden="true">
        <For each={steps}>
          {(_, index) => {
            const shifted = () => steps[(index() + offset()) % steps.length];
            return <span classList={{ "is-active": Boolean(shifted()) }} />;
          }}
        </For>
      </div>
      <figcaption>
        <span>Rotation: {offset()} steps</span>
        <button
          type="button"
          onClick={() => setOffset((value) => (value + 1) % steps.length)}
        >
          <span class="icon i-ri-refresh-line" aria-hidden="true" />
          Rotate pattern
        </button>
      </figcaption>
    </figure>
  );
}
