import "server-only";
import { FirestoreStore } from "./firestore-store";
import type { InspectionStore } from "./types";

let override: InspectionStore | null = null;
let real: InspectionStore | null = null;

/** Test seam: unit tests inject an in-memory store from tests/helpers. */
export function setStoreForTests(store: InspectionStore | null): void {
  override = store;
}

export function getStore(): InspectionStore {
  if (override) return override;
  real ??= new FirestoreStore();
  return real;
}

export * from "./types";
