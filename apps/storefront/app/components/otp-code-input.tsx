import {
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import { tokens } from "../theme";

const LENGTH = 6;

// OtpCodeInput renders the 6-digit verification code as individual boxes that
// auto-advance, accept a pasted code, and handle backspace/arrows — while
// keeping a single hidden <input name> so the surrounding <Form> still submits
// the combined value (no change to the server action). JS-enhanced; a customer
// typing a code always has JS.
export default function OtpCodeInput({
  name = "code",
  error = false,
  disabled = false,
  autoFocus = true,
}: {
  name?: string;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join("");

  function writeFrom(index: number, chars: string[]) {
    setDigits((prev) => {
      const next = [...prev];
      for (let k = 0; k < chars.length && index + k < LENGTH; k += 1) {
        next[index + k] = chars[k] ?? "";
      }
      return next;
    });
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length === 0) {
      writeFrom(index, [""]);
      return;
    }
    const chars = cleaned.slice(0, LENGTH - index).split("");
    writeFrom(index, chars);
    const focusTo = Math.min(index + chars.length, LENGTH - 1);
    refs.current[focusTo]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (digits[index]) {
        writeFrom(index, [""]);
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        writeFrom(index - 1, [""]);
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, LENGTH);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    setDigits(() => {
      const next = Array(LENGTH).fill("");
      pasted.split("").forEach((c, k) => {
        next[k] = c;
      });
      return next;
    });
    refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
  }

  return (
    <Box>
      <input type="hidden" name={name} value={code} readOnly />
      <Box
        sx={{
          display: "flex",
          gap: { xs: 0.75, sm: 1 },
          justifyContent: "space-between",
        }}
      >
        {digits.map((digit, index) => (
          <Box
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            component="input"
            ref={(el: HTMLInputElement | null) => {
              refs.current[index] = el;
            }}
            value={digit}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            maxLength={1}
            onChange={(e: { target: { value: string } }) =>
              handleChange(index, e.target.value)
            }
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
              handleKeyDown(index, e)
            }
            onPaste={handlePaste}
            onFocus={(e: { currentTarget: HTMLInputElement }) =>
              e.currentTarget.select()
            }
            sx={{
              flex: 1,
              minWidth: 0,
              height: { xs: 52, sm: 58 },
              textAlign: "center",
              fontSize: { xs: 22, sm: 26 },
              fontWeight: 800,
              fontFamily: "inherit",
              color: "text.primary",
              caretColor: tokens.burgundy,
              bgcolor: "rgba(var(--surface-rgb), 0.55)",
              border: "1.5px solid",
              borderColor: error ? "error.main" : "divider",
              borderRadius: "12px",
              outline: "none",
              transition: "border-color .15s ease, box-shadow .15s ease",
              "&:focus": {
                borderColor: error ? "error.main" : tokens.burgundy,
                boxShadow: `0 0 0 3px ${alpha(
                  error ? tokens.wine : tokens.burgundy,
                  0.16,
                )}`,
              },
              "&:disabled": { opacity: 0.55, cursor: "not-allowed" },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
