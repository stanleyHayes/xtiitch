import test from "node:test";
import assert from "node:assert/strict";
import { clearFormDraft } from "./use-form-draft";

// The scenario this exists for: a shop owner fills in a design, the upload dies
// on a weak connection, React Router replaces the route with the error boundary
// and the uncontrolled inputs go with it. The draft is what lets her come back
// to her own words instead of retyping everything.
//
// The hook itself needs a DOM, so these cover the storage contract around it —
// the part that decides whether her work survives.
const PREFIX = "xtiitch:draft:";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    get size() {
      return map.size;
    },
  };
}

function installStorage(store: ReturnType<typeof fakeStorage>) {
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: store },
    configurable: true,
    writable: true,
  });
}

test("a saved draft is addressed by its own key, not shared", () => {
  const store = fakeStorage();
  installStorage(store);
  store.setItem(`${PREFIX}add-design`, JSON.stringify({ title: "Kente wrap" }));
  store.setItem(`${PREFIX}other-form`, JSON.stringify({ title: "unrelated" }));

  clearFormDraft("add-design");

  assert.equal(
    store.getItem(`${PREFIX}add-design`),
    null,
    "the saved design draft should be gone",
  );
  assert.ok(
    store.getItem(`${PREFIX}other-form`),
    "clearing one form must not wipe another form's draft",
  );
});

test("clearing is safe when storage is unavailable", () => {
  // Private browsing throws on access. Losing a draft is bad; throwing during
  // render is worse.
  Object.defineProperty(globalThis, "window", {
    value: {
      get sessionStorage(): Storage {
        throw new Error("blocked");
      },
    },
    configurable: true,
    writable: true,
  });
  assert.doesNotThrow(() => clearFormDraft("add-design"));
});

test("clearing an absent draft is a no-op, not an error", () => {
  const store = fakeStorage();
  installStorage(store);
  assert.doesNotThrow(() => clearFormDraft("never-saved"));
  assert.equal(store.size, 0);
});
