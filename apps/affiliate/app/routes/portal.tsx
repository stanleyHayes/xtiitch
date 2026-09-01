import {
  data,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction
} from "react-router";
import { handlePortalAction } from "../features/portal/handle-portal-action.server";
import { loadPortal } from "../features/portal/load-portal.server";
import { PortalPage } from "../features/portal/PortalPage";

export const meta: MetaFunction = () => [
	{ title: "Performance | Xtiitch Partners" }
];

// Both the loader and the action may refresh an expired access token. The API
// rotates the refresh token when they do, so the new pair comes back as a
// Set-Cookie that MUST be forwarded — drop it and the rotated tokens are lost,
// the old refresh token is already revoked, and the very next request signs the
// affiliate out. That is precisely the bounce this path exists to prevent.
export async function loader({ request }: LoaderFunctionArgs) {
  const { data: portal, setCookie } = await loadPortal(request);
  return setCookie
    ? data(portal, { headers: { "Set-Cookie": setCookie } })
    : portal;
}

export async function action({ request }: ActionFunctionArgs) {
  const { result, setCookie } = await handlePortalAction(request);
  return setCookie
    ? data(result, { headers: { "Set-Cookie": setCookie } })
    : result;
}

export default function Portal() {
  const portal = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return <PortalPage data={portal} actionData={actionData} />;
}
