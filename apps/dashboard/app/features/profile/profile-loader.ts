import type { Route } from "../../routes/+types/profile";
import { apiFetch } from "../../lib/auth";

// The signed-in owner's own profile row (§9), from GET /auth/business/me —
// read live, so edits via PATCH are reflected here (and everywhere the
// dashboard shows them) immediately after revalidation.
export type OwnProfile = {
  email: string;
  display_name: string;
  phone: string;
  phone_verified: boolean;
  whatsapp_number: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  // apiFetch throws the /login redirect itself when there is no usable session.
  const response = await apiFetch(request, "/auth/business/me", {
    method: "GET",
  });
  if (!response.ok) {
    throw new Response("Your profile could not be loaded right now.", {
      status: 502,
    });
  }
  const body = (await response.json()) as Partial<OwnProfile>;
  return {
    profile: {
      email: typeof body.email === "string" ? body.email : "",
      display_name:
        typeof body.display_name === "string" ? body.display_name : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      phone_verified: body.phone_verified === true,
      whatsapp_number:
        typeof body.whatsapp_number === "string" ? body.whatsapp_number : "",
    } satisfies OwnProfile,
  };
}
