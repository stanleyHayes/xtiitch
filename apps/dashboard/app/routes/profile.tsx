import type { Route } from "./+types/profile";
import { ProfileSection } from "../features/profile/ProfileSection";
import type { ProfileActionResult } from "../features/profile/profile-action";

export { action } from "../features/profile/profile-action";
export { loader } from "../features/profile/profile-loader";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Profile settings · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// React Router injects loaderData/actionData only into a route module's
// LOCALLY-declared default export, so the section component is wrapped here
// (same pattern as routes/security.tsx).
export default function ProfileRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <ProfileSection
      profile={loaderData.profile}
      result={(actionData ?? {}) as ProfileActionResult}
    />
  );
}
