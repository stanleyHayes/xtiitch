import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NotesRounded from "@mui/icons-material/NotesRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import { tokens } from "../../theme";
import { ToneChip } from "../../components/ui/ToneChip";
import TextField from "../../components/form-text-field";

// §15.1 annotation editors on the customer profile: notes at Starter+ ("a
// place to jot 'prefers loose sleeves'"), tags at Growth+ ("VIP", "wholesale",
// "bride"). Both submit through the dashboard action and re-mount from the
// revalidated profile after save (§1.2 reset via the parent's key).

export function CustomerNoteEditor({
  customerId,
  note,
  error,
}: {
  customerId: string;
  note: string;
  error?: string;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
        <NotesRounded sx={{ fontSize: 18, color: "primary.main" }} />
        <Typography sx={{ fontWeight: 900 }}>Your note</Typography>
      </Stack>
      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      <Stack component={Form} method="post" spacing={1}>
        <input type="hidden" name="intent" value="save_crm_note" />
        <input type="hidden" name="customer_id" value={customerId} />
        <TextField
          name="note"
          label="Note"
          multiline
          minRows={2}
          fullWidth
          defaultValue={note}
          placeholder="e.g. prefers loose sleeves, always late to collect"
        />
        <Box>
          <Button type="submit" size="small" variant="contained">
            Save note
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export function CustomerTagsEditor({
  customerId,
  tags,
  error,
}: {
  customerId: string;
  tags: string[];
  error?: string;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
        <LocalOfferRounded sx={{ fontSize: 18, color: "primary.main" }} />
        <Typography sx={{ fontWeight: 900 }}>Tags</Typography>
      </Stack>
      {tags.length > 0 ? (
        <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <ToneChip key={tag} label={tag} tone={tokens.burgundy} />
          ))}
        </Stack>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      <Stack
        component={Form}
        method="post"
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
      >
        <input type="hidden" name="intent" value="save_crm_tags" />
        <input type="hidden" name="customer_id" value={customerId} />
        <TextField
          name="tags"
          label="Tags"
          size="small"
          fullWidth
          defaultValue={tags.join(", ")}
          placeholder="VIP, wholesale, bride"
        />
        <Button type="submit" size="small" variant="contained" sx={{ flexShrink: 0 }}>
          Save
        </Button>
      </Stack>
    </Box>
  );
}
