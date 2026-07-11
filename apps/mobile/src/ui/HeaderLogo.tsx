import { Image } from "react-native";
import { useBranding } from "../branding";
import { XtiitchMark } from "./XtiitchMark";

// Header lockup: render the operator's custom platform logo when one is set
// (via the branding endpoint), else fall back to the built-in ii-stitch mark.
// Used in the navigation header so every screen carries the active brand.
export function HeaderLogo({ color = "#800020" }: { color?: string }) {
  const { logoUrl } = useBranding();
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        resizeMode="contain"
        accessibilityLabel="Platform logo"
        style={{ height: 28, width: 132 }}
      />
    );
  }
  return <XtiitchMark color={color} size={24} />;
}
