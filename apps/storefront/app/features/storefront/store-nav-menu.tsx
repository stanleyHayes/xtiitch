import { useState } from "react";
import { Link as RouterLink } from "react-router";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { alpha } from "@mui/material/styles";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";

// §10.3: on phones the tenant/marketplace store header's top buttons (Cart,
// Track order, Account, About Xtiitch) collapse into one menu icon instead of
// wrapping raw across the hero. Small screens only — desktop keeps the buttons.
export function StoreNavMenu({ onBrand }: { onBrand?: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        aria-label="Open store menu"
        aria-haspopup="menu"
        aria-expanded={anchor ? "true" : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          display: { xs: "inline-flex", md: "none" },
          width: 44,
          height: 44,
          p: 0,
          color: onBrand || "text.primary",
          border: "1px solid",
          borderColor: onBrand ? alpha(onBrand, 0.32) : "divider",
          borderRadius: 1.5,
          "& .MuiSvgIcon-root": { fontSize: 24 },
        }}
      >
        <MenuRounded />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem component={RouterLink} to="/cart" onClick={close}>
          <ListItemIcon>
            <ShoppingBagRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cart</ListItemText>
        </MenuItem>
        <MenuItem component={RouterLink} to="/track" onClick={close}>
          <ListItemIcon>
            <LocalShippingRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Track order</ListItemText>
        </MenuItem>
        <MenuItem component={RouterLink} to="/account" onClick={close}>
          <ListItemIcon>
            <AccountCircleRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Account</ListItemText>
        </MenuItem>
        <MenuItem
          component="a"
          href="https://xtiitch.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          <ListItemIcon>
            <InfoOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>About Xtiitch</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
