import Box from "@mui/material/Box";
import TextField from "../../components/form-text-field";

export function ContactFields() {
  return (
    <>
      <TextField
        name="customer_name"
        label="Full name"
        required
        fullWidth
        autoComplete="name"
      />
      <TextField
        name="customer_phone"
        label="Phone"
        fullWidth
        autoComplete="tel"
      />
      <TextField
        name="customer_email"
        label="Email"
        type="email"
        required
        fullWidth
        autoComplete="email"
      />
    </>
  );
}

// A free-text note the shopper can leave for the store. Present on the made-to-
// wear order and on all three bespoke options.
export function NoteField() {
  return (
    <TextField
      name="note"
      label="Note for the store (optional)"
      placeholder="Colour, fabric, timing, or any special request…"
      fullWidth
      multiline
      minRows={2}
    />
  );
}

export function LoadingButtonLabel({ label }: { label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.85,
        "@keyframes xtiitchButtonDot": {
          "0%, 80%, 100%": { opacity: 0.42, transform: "translateY(0)" },
          "40%": { opacity: 1, transform: "translateY(-4px)" },
        },
      }}
    >
      <Box component="span">{label}</Box>
      <Box
        component="span"
        aria-hidden
        sx={{ display: "inline-flex", gap: 0.45, pt: "2px" }}
      >
        {["0ms", "120ms", "240ms"].map((delay) => (
          <Box
            key={delay}
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              bgcolor: "currentColor",
              animation: `xtiitchButtonDot 900ms ease-in-out ${delay} infinite`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
