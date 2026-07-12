import { data, redirect } from "react-router";
import type { Route } from "./+types/design";
import { api } from "../lib/api";
import { addToCart } from "../lib/cart";
import { getSession } from "../lib/session";
import {
  actionFailure,
  attributionPayload,
  availabilityRangeForRequest,
  collectMeasurements,
  customOrderMessage,
  relatedDesignsFor,
  rewardCodesFromForm,
  rewardCodesFromRequest,
  rewardPayload,
  toCustomSizeMode,
} from "../features/design/utils";

export async function loader({ params, request }: Route.LoaderArgs) {
  const design = await api.design(params.handle);
  if (!design) {
    // Deleted or unpublished: render a friendly in-store notice (below) rather
    // than a hard error page. The 404 status keeps it out of search results.
    return data({ notFound: true } as const, { status: 404 });
  }
  const rewardCodes = await rewardCodesFromRequest(request);
  const availabilityRange = availabilityRangeForRequest();
  const [referralPreview, availability, storePage] = await Promise.all([
    rewardCodes.referralCode
      ? api.referral(rewardCodes.referralCode).catch(() => null)
      : Promise.resolve(null),
    design.store?.handle &&
    design.customisation_allowed &&
    design.store.settings.bespoke_enabled
      ? api
          .availability(design.store.handle, availabilityRange)
          .catch(() => null)
      : Promise.resolve(null),
    design.store?.handle
      ? api.store(design.store.handle).catch(() => null)
      : Promise.resolve(null),
  ]);
  return {
    design,
    rewardCodes,
    referralPreview,
    visitSlots: availability?.slots ?? [],
    relatedDesigns: relatedDesignsFor(design, storePage?.designs ?? []),
  };
}

export function meta({ data: loaded }: Route.MetaArgs) {
  const design = loaded && "design" in loaded ? loaded.design : null;
  if (!design) {
    return [
      { title: "Piece unavailable · Xtiitch" },
      { name: "robots", content: "noindex" },
    ];
  }
  const title = design.title;
  return [
    { title: `${title} · Xtiitch` },
    {
      name: "description",
      content: design.description || `View ${title} on Xtiitch.`,
    },
  ];
}

export async function action({ request, params }: Route.ActionArgs) { // eslint-disable-line complexity, max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "standard");
  const storeHandle = String(form.get("store_handle") ?? "").trim();
  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const method =
    String(form.get("method") ?? "momo") === "card" ? "card" : "momo";
  const rewardCodes = rewardCodesFromForm(form);

  if (intent === "add_to_cart" || intent === "buy_now") {
    const designHandle = params.handle ?? "";
    const title = String(form.get("title") ?? "").trim();
    const image = String(form.get("image") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const kind =
      String(form.get("kind") ?? "made_to_wear") === "bespoke"
        ? "bespoke"
        : "made_to_wear";
    if (!storeHandle || !designHandle || !title) {
      return actionFailure(
        rewardCodes,
        "Could not add that to your cart.",
        null,
      );
    }
    let sizeBandID = "";
    let sizeLabel: string;
    let sizeMode: "self_measure" | "home_visit" | "come_to_shop" | undefined;
    let measurements: Record<string, string> | undefined;
    let amountMinor: number;
    if (kind === "bespoke") {
      sizeMode =
        toCustomSizeMode(String(form.get("size_mode") ?? "")) ?? undefined;
      if (sizeMode !== "self_measure") {
        return actionFailure(
          rewardCodes,
          null,
          "Only self-measure bespoke deposits can be added to cart. Use the visit or shop route separately.",
        );
      }
      measurements = collectMeasurements(form);
      if (Object.keys(measurements).length === 0) {
        return actionFailure(
          rewardCodes,
          null,
          "Add at least one measurement before adding this bespoke deposit to cart.",
        );
      }
      amountMinor =
        Number.parseInt(String(form.get("deposit_minor") ?? "0"), 10) || 0;
      sizeLabel = "Self-measure deposit";
    } else {
      sizeBandID = String(form.get("size_band_id") ?? "").trim();
      try {
        const bands = JSON.parse(String(form.get("bands_json") ?? "[]")) as {
          size_band_id: string;
          label: string;
          price_minor: number;
        }[];
        const band = bands.find((entry) => entry.size_band_id === sizeBandID);
        if (!band) {
          return actionFailure(
            rewardCodes,
            "Choose a size before adding to cart.",
            null,
          );
        }
        sizeLabel = band.label;
        amountMinor = band.price_minor;
      } catch {
        return actionFailure(
          rewardCodes,
          "Could not add that to your cart.",
          null,
        );
      }
    }
    const cookie = await addToCart(request, {
      store_handle: storeHandle,
      design_handle: designHandle,
      title,
      image,
      kind,
      size_band_id: sizeBandID,
      size_label: sizeLabel,
      amount_minor: amountMinor,
      size_mode: sizeMode,
      measurements,
      note: note || undefined,
    });
    // Pay Now takes the shopper straight to this store's checkout (the ?store=
    // scopes it in a multi-store basket; personal details are collected there);
    // Add to Cart lands on the cart. Neither collects contact here.
    const destination =
      intent === "buy_now"
        ? `/checkout?store=${encodeURIComponent(storeHandle)}`
        : "/cart";
    return redirect(destination, { headers: { "Set-Cookie": cookie } });
  }

  if (intent === "waitlist") {
    const contact = String(form.get("customer_contact") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    if (!storeHandle || !customerName || !contact) {
      return {
        customError: null,
        rewardCodes,
        standardError: null,
        waitlistError: "Add your name and a phone number or email.",
        waitlistSuccess: false,
      };
    }
    const response = await api.joinWaitlist(storeHandle, params.handle, {
      customer_name: customerName,
      customer_contact: contact,
      note,
    });
    if (!response.ok) {
      return {
        customError: null,
        rewardCodes,
        standardError: null,
        waitlistError:
          response.status === 409
            ? "This store is not taking waiting-list sign-ups right now."
            : "Could not join the waiting list. Please try again.",
        waitlistSuccess: false,
      };
    }
    return {
      customError: null,
      rewardCodes,
      standardError: null,
      waitlistError: null as string | null,
      waitlistSuccess: true,
    };
  }

  if (intent === "custom") {
    // §3b: taking a bespoke deposit is a payment, so it needs a verified
    // customer session too. Send guests to sign in and back to this design.
    const session = await getSession(request.headers.get("Cookie"));
    if (!session.get("customerToken")) {
      return redirect(
        `/account?redirectTo=/d/${encodeURIComponent(params.handle ?? "")}`,
      );
    }
    const sizeMode = toCustomSizeMode(String(form.get("size_mode") ?? ""));
    const note = String(form.get("note") ?? "").trim();
    if (!storeHandle || !sizeMode || !customerName || !customerEmail) {
      return actionFailure(
        rewardCodes,
        null,
        "Choose a bespoke route and add your name and email.",
      );
    }

    if (sizeMode === "home_visit") {
      const slotStart = String(form.get("slot_start") ?? "").trim();
      const address = String(form.get("address") ?? "").trim();
      if (!slotStart || !address) {
        return actionFailure(
          rewardCodes,
          null,
          "Choose a visit slot and add the visit address.",
        );
      }

      const response = await api.placeBooking(storeHandle, {
        design_handle: params.handle,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        method,
        ...attributionPayload(rewardCodes),
        slot_start: slotStart,
        address,
        note: note || undefined,
      });

      if (!response.ok) {
        return actionFailure(
          rewardCodes,
          null,
          customOrderMessage(response.error),
        );
      }

      if (response.result.authorization_url) {
        return redirect(response.result.authorization_url);
      }
      return redirect(`/track/${response.result.order_id}`);
    }

    const measurements = collectMeasurements(form);
    if (sizeMode === "self_measure" && Object.keys(measurements).length === 0) {
      return actionFailure(
        rewardCodes,
        null,
        "Add at least one self-measurement before paying the deposit.",
      );
    }

    const response = await api.placeCustomOrder(storeHandle, {
      design_handle: params.handle,
      size_mode: sizeMode,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      method: sizeMode === "come_to_shop" ? undefined : method,
      ...rewardPayload(rewardCodes),
      measurements: sizeMode === "self_measure" ? measurements : undefined,
      note: note || undefined,
    });

    if (!response.ok) {
      return actionFailure(
        rewardCodes,
        null,
        customOrderMessage(response.error),
      );
    }

    if (response.result.authorization_url) {
      return redirect(response.result.authorization_url);
    }
    return redirect(`/track/${response.result.order_id}`);
  }

  // Made-to-wear and self-measure bespoke buys now flow through the cart (the
  // add_to_cart / buy_now branch above); nothing else should reach here.
  return actionFailure(
    rewardCodes,
    "Something went wrong. Please try again.",
    null,
  );
}

// React Router only injects loaderData/actionData props into a route module's
// LOCALLY-declared default export — a bare `export { default } from …` re-export
// does NOT receive them (the component sees undefined loaderData and crashes).
// Wrap the moved component in a local default so the props are injected here and
// forwarded on.
import DesignPage from "../features/design/design-page";

export default function DesignRoute(props: Route.ComponentProps) {
  return <DesignPage {...props} />;
}
