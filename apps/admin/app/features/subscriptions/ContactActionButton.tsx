import type { ReactNode } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";



export function ContactActionButton({
  label,
  href,
  icon,
  external = false,
}: {
  label: string;
  href?: string;
  icon: ReactNode;
  external?: boolean;
}) {
  return (
    <Tooltip title={label}>
      <span>
        {href ? (
          <IconButton
            component="a"
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            aria-label={label}
            size="small"
          >
            {icon}
          </IconButton>
        ) : (
          <IconButton aria-label={label} size="small" disabled>
            {icon}
          </IconButton>
        )}
      </span>
    </Tooltip>
  );
}
