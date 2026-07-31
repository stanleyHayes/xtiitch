import type { ReactNode } from "react";

// A radio group that looks like the rest of the product instead of like the
// operating system. Native <select> renders an OS dropdown — Chrome on macOS
// paints the highlighted row system-blue, which has nothing to do with the
// brand and cannot be styled. With two or three options a card group is also
// simply better: every choice is visible without opening anything.
//
// These are still real <input type="radio"> elements, so keyboard arrows,
// form submission and screen readers all work as they always did. Only the
// paint is ours (see .choice-* in styles.css).
export type Choice = {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
};

export function ChoiceCards({
  name,
  legend,
  choices,
  defaultValue,
  columns = 2,
  onChange,
}: {
  name: string;
  legend: string;
  choices: Choice[];
  defaultValue?: string;
  columns?: number;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset className="field-set choice-set">
      <legend>{legend}</legend>
      <div
        className="choice-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {choices.map((choice) => (
          <label className="choice" key={choice.value}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              defaultChecked={defaultValue === choice.value}
              onChange={() => onChange?.(choice.value)}
            />
            {choice.icon ? (
              <span className="choice-icon" aria-hidden="true">
                {choice.icon}
              </span>
            ) : null}
            <span className="choice-body">
              <span className="choice-label">{choice.label}</span>
              {choice.hint ? (
                <span className="choice-hint">{choice.hint}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
