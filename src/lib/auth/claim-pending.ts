"use client";

/**
 * After sign-up or sign-in, hand any pending (pre-authentication) inspections to the permanent account.
 *
 * - Sign-up / Google link: the anonymous identity was upgraded in place (same UID), so pending records are
 *   listed with the account's own token and simply queued.
 * - Sign-in to an EXISTING account: the caller must also hold the anonymous identity. Its token is listed
 *   and sent as X-Anonymous-Token; the server verifies both tokens before moving anything.
 */
interface PendingRecord {
  id: string;
  status: string;
}

export async function claimPendingInspections(accountToken: string, anonymousToken?: string): Promise<{ claimed: number; failed: number }> {
  const listToken = anonymousToken ?? accountToken;
  let claimed = 0;
  let failed = 0;
  try {
    const res = await fetch("/api/inspections?limit=20", { headers: { Authorization: `Bearer ${listToken}` }, cache: "no-store" });
    if (!res.ok) return { claimed, failed };
    const { inspections } = (await res.json()) as { inspections: PendingRecord[] };
    for (const rec of inspections.filter((i) => i.status === "pending_auth")) {
      const r = await fetch("/api/inspections/claim", {
        method: "POST",
        headers: { Authorization: `Bearer ${accountToken}`, "Content-Type": "application/json", ...(anonymousToken ? { "X-Anonymous-Token": anonymousToken } : {}) },
        body: JSON.stringify({ inspectionId: rec.id }),
      });
      if (r.ok) claimed++;
      else failed++;
    }
  } catch {
    failed++;
  }
  return { claimed, failed };
}
