import { useRef, useState } from "react";
import { Link as RouterLink } from "react-router";
import type { TextFieldProps } from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Link from "@mui/material/Link";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { alpha } from "@mui/material/styles";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import TextField from "./form-text-field";

// The ✨ menu. Each entry maps to an instruction the API understands; the labels
// are what the business sees.
const INSTRUCTIONS: { key: string; label: string }[] = [
  { key: "improve", label: "Improve writing" },
  { key: "rewrite", label: "Rewrite" },
  { key: "shorten", label: "Make shorter" },
  { key: "expand", label: "Make longer" },
  { key: "friendly", label: "Friendlier tone" },
  { key: "fix", label: "Fix spelling & grammar" },
];

type AssistResponse = { result?: string; error?: string; code?: string };

export type AiAssistFieldProps = Omit<TextFieldProps, "value" | "onChange"> & {
  /** Initial text for the (now controlled) field. */
  defaultValue?: string;
  /** Human label sent to the assistant so it knows what it's editing. */
  assistField?: string;
};

/**
 * AiAssistField is a multiline text field with a ✨ AI writing-assist button. It
 * keeps the field value in local state (so the assistant can replace it and the
 * business can Undo) while still submitting under the given `name` like any other
 * field. The ✨ button posts the current text + chosen instruction to the
 * /ai/assist resource route; on success the field is replaced, with an Undo to
 * restore the previous text. A 402 surfaces the "paid add-on" prompt inline.
 */
export default function AiAssistField({
  defaultValue = "",
  assistField,
  helperText,
  ...textFieldProps
}: AiAssistFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [previous, setPrevious] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addonPrompt, setAddonPrompt] = useState(false);
  const requestId = useRef(0);

  const label =
    assistField ??
    (typeof textFieldProps.label === "string" ? textFieldProps.label : "text");

  function closeMenu() {
    setMenuAnchor(null);
  }

  async function runAssist(instruction: string) {
    closeMenu();
    const text = value.trim();
    if (!text || loading) {
      if (!text) {
        setNotice("Write something first, then let ✨ polish it.");
      }
      return;
    }

    const id = requestId.current + 1;
    requestId.current = id;
    setLoading(true);
    setNotice(null);
    setAddonPrompt(false);

    try {
      const response = await fetch("/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, instruction, field: label }),
      });
      // A newer request superseded this one; drop the stale result.
      if (requestId.current !== id) {
        return;
      }

      if (response.status === 402) {
        setAddonPrompt(true);
        return;
      }

      const data = (await response.json().catch(() => null)) as AssistResponse | null;
      if (!response.ok || !data || typeof data.result !== "string") {
        setNotice("✨ couldn't rewrite that just now. Please try again.");
        return;
      }

      if (data.result.trim() && data.result !== value) {
        setPrevious(value);
        setValue(data.result);
      } else {
        setNotice("✨ had no changes to suggest.");
      }
    } catch {
      if (requestId.current === id) {
        setNotice("✨ couldn't rewrite that just now. Please try again.");
      }
    } finally {
      if (requestId.current === id) {
        setLoading(false);
      }
    }
  }

  function undo() {
    if (previous === null) {
      return;
    }
    setValue(previous);
    setPrevious(null);
    setNotice(null);
  }

  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
      <TextField
        {...textFieldProps}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        helperText={helperText}
        slotProps={{
          ...textFieldProps.slotProps,
          input: {
            ...(textFieldProps.slotProps?.input as object | undefined),
            endAdornment: (
              <Box
                sx={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.25,
                }}
              >
                {previous !== null ? (
                  <Tooltip title="Undo ✨">
                    <IconButton
                      size="small"
                      onClick={undo}
                      aria-label="Undo AI rewrite"
                      sx={{ color: "text.secondary" }}
                    >
                      <UndoRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
                <Tooltip title="AI writing assistant">
                  <span>
                    <IconButton
                      size="small"
                      onClick={(event) => setMenuAnchor(event.currentTarget)}
                      disabled={loading}
                      aria-label="AI writing assistant"
                      sx={(theme) => ({
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, 0.16),
                        },
                      })}
                    >
                      {loading ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <AutoAwesomeRounded fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ),
          },
        }}
      />

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {INSTRUCTIONS.map((option) => (
          <MenuItem
            key={option.key}
            onClick={() => runAssist(option.key)}
            sx={{ fontSize: 14, fontWeight: 600 }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>

      {addonPrompt ? (
        <Fade in>
          <Box
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: 1.5,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
            })}
          >
            <AutoAwesomeRounded
              fontSize="small"
              sx={{ color: "primary.main" }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              AI Assistant is a paid add-on —{" "}
              <Link
                component={RouterLink}
                to="/addons/ai-assistant"
                sx={{ fontWeight: 700 }}
              >
                enable the add-on
              </Link>{" "}
              to use ✨
            </Typography>
          </Box>
        </Fade>
      ) : null}

      {notice ? (
        <Typography variant="caption" sx={{ color: "text.secondary", px: 0.5 }}>
          {notice}
        </Typography>
      ) : null}
    </Box>
  );
}
