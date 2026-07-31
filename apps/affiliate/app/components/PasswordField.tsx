import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons";

// A password input with a show/hide toggle. Typing a password blind is the
// single biggest cause of failed sign-ins on phones, where autocorrect and
// small keys make a silent typo likely — and on the reset screens, where the
// value has to be typed twice and matched.
//
// The toggle is a real <button type="button">: inside a form, a bare <button>
// defaults to type="submit" and would post the form on click.
export function PasswordField({
  name,
  label,
  placeholder,
  autoComplete,
  minLength = 8,
  required = false,
  labelAccessory
}: {
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  // e.g. the "Forgot password?" link that sits opposite the label.
  labelAccessory?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {labelAccessory ? (
          <span className="label-row">
            {label}
            {labelAccessory}
          </span>
        ) : (
          label
        )}
      </label>
      <div className="password-wrap">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
          className="password-input"
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          // The control is icon-only, so the label has to carry the meaning,
          // and aria-pressed carries the state.
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
        </button>
      </div>
    </div>
  );
}
