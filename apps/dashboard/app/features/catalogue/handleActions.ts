import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import { parseSequence, parseSizeChartJSON } from "../shared/utils";

export async function handleCatalogueActions( // eslint-disable-line complexity -- intent dispatcher with many conditional branches; refactor in follow-up
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "create_collection") {
    const sequence = parseSequence(form.get("sequence"));
    if (sequence === null) {
      return {
        collectionError:
          "Use a zero or positive display order for the collection.",
      };
    }
    const response = await apiFetch(request, "/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? "").trim(),
        theme: String(form.get("theme") ?? "").trim(),
        sequence,
      }),
    });
    if (!response.ok) {
      return {
        collectionError:
          "Could not create that collection. Add a name and unique display order.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

if (intent === "retire_collection" || intent === "restore_collection") {
    const collectionID = String(form.get("collection_id") ?? "").trim();
    if (!collectionID) {
      return { collectionError: "That collection could not be found." };
    }
    const actionName = intent === "retire_collection" ? "retire" : "restore";
    const response = await apiFetch(
      request,
      `/collections/${encodeURIComponent(collectionID)}/${actionName}`,
      { method: "POST" },
    );
    if (!response.ok) {
      return { collectionError: "Could not update that collection." };
    }
    return redirect("/dashboard/catalogue");
  }

if (intent === "delete_collection") {
    const collectionID = String(form.get("collection_id") ?? "").trim();
    if (!collectionID) {
      return { collectionError: "That collection could not be found." };
    }
    const response = await apiFetch(
      request,
      `/collections/${encodeURIComponent(collectionID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return {
        collectionError:
          "Could not remove that collection. Retire it first if it is still active.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

if (intent === "update_collection") {
    const collectionID = String(form.get("collection_id") ?? "").trim();
    const sequence = parseSequence(form.get("sequence"));
    if (!collectionID || sequence === null) {
      return {
        collectionError: "Could not update that collection. Check the order.",
      };
    }
    const response = await apiFetch(
      request,
      `/collections/${encodeURIComponent(collectionID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          theme: String(form.get("theme") ?? "").trim(),
          sequence,
        }),
      },
    );
    if (!response.ok) {
      return {
        collectionError:
          "Could not update that collection. Add a name and an unused display order.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

if (intent === "create_size_band" || intent === "update_size_band") {
    const sequence = parseSequence(form.get("sequence"));
    if (sequence === null) {
      return {
        sizeBandError: "Use a zero or positive display order for the size.",
      };
    }
    const body = JSON.stringify({
      label: String(form.get("label") ?? "").trim(),
      chart: parseSizeChartJSON(form.get("chart_json")),
      sequence,
    });
    const sizeBandID = String(form.get("size_band_id") ?? "").trim();
    const isUpdate = intent === "update_size_band";
    if (isUpdate && !sizeBandID) {
      return { sizeBandError: "That size band could not be found." };
    }
    const response = await apiFetch(
      request,
      isUpdate
        ? `/size-bands/${encodeURIComponent(sizeBandID)}`
        : "/size-bands",
      {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    );
    if (!response.ok) {
      return {
        sizeBandError:
          "Could not save that size band. Add a label, a unique display order, and complete chart rows.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

if (intent === "delete_size_band") {
    const sizeBandID = String(form.get("size_band_id") ?? "").trim();
    if (!sizeBandID) {
      return { sizeBandError: "That size band could not be found." };
    }
    const response = await apiFetch(
      request,
      `/size-bands/${encodeURIComponent(sizeBandID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return { sizeBandError: "Could not delete that size band." };
    }
    return redirect("/dashboard/catalogue");
  }
  return null;
}
