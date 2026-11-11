import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-internyra",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { uid: "alice", email: "alice@example.test" });
    await setDoc(doc(db, "users/bob"), { uid: "bob" });
    await setDoc(doc(db, "users/alice/inspections/insp_a1"), { id: "insp_a1", ownerUid: "alice", status: "completed" });
    await setDoc(doc(db, "users/bob/inspections/insp_b1"), { id: "insp_b1", ownerUid: "bob", status: "queued" });
    await setDoc(doc(db, "inspectionJobs/insp_a1"), { ownerUid: "alice", status: "completed" });
    await setDoc(doc(db, "usageEvents/e1"), { type: "research" });
    await setDoc(doc(db, "adminAuditLogs/l1"), { action: "x" });
  });
});

const as = (uid: string, claims: Record<string, unknown> = {}) => env.authenticatedContext(uid, claims).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe("reads: students see only their own data", () => {
  it("signed-out visitors can read nothing", async () => {
    await assertFails(getDoc(doc(anon(), "users/alice")));
    await assertFails(getDoc(doc(anon(), "users/alice/inspections/insp_a1")));
  });
  it("a student can read their own profile and inspections", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "users/alice")));
    await assertSucceeds(getDoc(doc(as("alice"), "users/alice/inspections/insp_a1")));
    await assertSucceeds(getDocs(collection(as("alice"), "users/alice/inspections")));
  });
  it("student B cannot read student A's profile or inspections (IDOR)", async () => {
    await assertFails(getDoc(doc(as("bob"), "users/alice")));
    await assertFails(getDoc(doc(as("bob"), "users/alice/inspections/insp_a1")));
    await assertFails(getDocs(collection(as("bob"), "users/alice/inspections")));
  });
  it("a collection-group query cannot be used to read other students' inspections", async () => {
    await assertFails(getDocs(collectionGroup(as("bob"), "inspections")));
    await assertFails(getDocs(query(collectionGroup(as("bob"), "inspections"), where("ownerUid", "==", "alice"))));
  });
  it("an anonymous Firebase identity can read only its own data", async () => {
    await assertFails(getDoc(doc(env.authenticatedContext("visitor", { firebase: { sign_in_provider: "anonymous" } }).firestore(), "users/alice")));
  });
});

describe("writes: clients can never write", () => {
  it("a student cannot create, update or delete inspections, even their own", async () => {
    const db = as("alice");
    await assertFails(setDoc(doc(db, "users/alice/inspections/insp_new"), { id: "insp_new", ownerUid: "alice", status: "completed" }));
    await assertFails(updateDoc(doc(db, "users/alice/inspections/insp_a1"), { status: "queued" }));
    await assertFails(updateDoc(doc(db, "users/alice/inspections/insp_a1"), { research: { status: "no_major_red_flags_found" } }));
    await assertFails(deleteDoc(doc(db, "users/alice/inspections/insp_a1")));
  });
  it("a student cannot write into another student's tree", async () => {
    await assertFails(setDoc(doc(as("bob"), "users/alice/inspections/insp_x"), { ownerUid: "alice" }));
    await assertFails(updateDoc(doc(as("bob"), "users/alice/inspections/insp_a1"), { status: "failed" }));
  });
  it("a student cannot set roles or admin flags on their profile", async () => {
    const db = as("alice");
    await assertFails(updateDoc(doc(db, "users/alice"), { admin: true }));
    await assertFails(updateDoc(doc(db, "users/alice"), { role: "admin", isAdmin: true }));
    await assertFails(setDoc(doc(db, "users/alice"), { uid: "alice", isAdmin: true }));
    await assertFails(deleteDoc(doc(db, "users/alice")));
  });
  it("server-managed collections are closed to clients", async () => {
    const db = as("alice");
    for (const path of ["inspectionJobs/insp_a1", "usageEvents/e1", "adminAuditLogs/l1"]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { x: 1 }));
      await assertFails(deleteDoc(doc(db, path)));
    }
    await assertFails(setDoc(doc(db, "adminAuditLogs/forged"), { adminUid: "alice", action: "admin.read.users" }));
    await assertFails(setDoc(doc(db, "usageEvents/forged"), { type: "research", provider: "gemini" }));
  });
});

describe("admin: the custom claim does not open client access (admin data goes through verified server routes)", () => {
  it("an admin-claim token still cannot read others' data, audit logs or usage events from the client", async () => {
    const db = as("owner", { admin: true });
    await assertFails(getDoc(doc(db, "users/alice")));
    await assertFails(getDoc(doc(db, "users/alice/inspections/insp_a1")));
    await assertFails(getDoc(doc(db, "adminAuditLogs/l1")));
    await assertFails(getDoc(doc(db, "usageEvents/e1")));
    await assertFails(getDocs(collectionGroup(db, "inspections")));
  });
  it("a claim supplied by the client cannot be used to forge writes", async () => {
    await assertFails(setDoc(doc(as("alice", { admin: true }), "adminAuditLogs/x"), { a: 1 }));
  });
});

describe("default deny", () => {
  it("unknown collections are closed", async () => {
    await assertFails(getDoc(doc(as("alice"), "secrets/anything")));
    await assertFails(setDoc(doc(as("alice"), "settings/global"), { a: 1 }));
    await assertFails(setDoc(doc(as("alice"), "pendingInspections/old"), { anonymousUid: "alice" }));
  });
});
