import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { tokens } from "../../../theme";
import { alpha } from "@mui/material/styles";

export function RailFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <Box>
      <Form method="post">
        <input type="hidden" name="intent" value="logout" />
        {collapsed ? (
          <Tooltip title="Sign out" placement="right">
            <IconButton
              type="submit"
              aria-label="Sign out"
              sx={{
                width: "100%",
                height: 48,
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.16),
                bgcolor: "rgba(var(--surface-rgb), 0.06)",
                borderRadius: 1.5,
                "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
              }}
            >
              <LogoutRounded />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            type="submit"
            color="inherit"
            startIcon={<LogoutRounded />}
            fullWidth
            sx={{
              color: tokens.white,
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.16),
              bgcolor: "rgba(var(--surface-rgb), 0.06)",
              "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
            }}
          >
            Sign out
          </Button>
        )}
      </Form>
    </Box>
  );
}
