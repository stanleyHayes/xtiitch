import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import { tokens } from "../../theme";

export function CopyLinkButton({
  url,
  label = "Copy share link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can be unavailable in insecure contexts; surface the URL
      // so the owner can copy it by hand rather than failing silently.
      window.prompt("Copy this share link", url);
    }
  };
  return (
    <Tooltip title={copied ? "Copied!" : label}>
      <IconButton
        type="button"
        size="small"
        aria-label={label}
        onClick={onCopy}
        sx={{
          color: copied ? tokens.success : "text.secondary",
          bgcolor: "rgba(var(--surface-rgb), 0.82)",
          "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.96)" },
        }}
      >
        {copied ? (
          <CheckCircleRounded fontSize="small" />
        ) : (
          <ContentCopyRounded fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}