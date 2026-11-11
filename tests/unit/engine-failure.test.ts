import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/engine/text", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine/text")>()),
  analyzeText: () => {
    throw new Error("boom");
  },
}));

const { runVerification, validateReportIntegrity } = await import("@/lib/engine");

describe("internal check failures", () => {
  it("marks every text check FAILED and the case PARTIAL instead of omitting them", async () => {
    const c = await runVerification({ kind: "message", text: "Please pay the registration fee of Rs 2,500 today." });
    expect(c.lifecycle).toBe("PARTIAL");
    for (const id of ["content.payment", "content.sensitive-data", "content.contact-patterns", "content.entities"]) {
      const check = c.report!.checks.find((x) => x.id === id);
      expect(check?.status, id).toBe("FAILED");
    }
    expect(c.report!.checks.filter((x) => x.id === "content.payment")).toHaveLength(1);
    expect(c.report!.assessment.assessment).toBe("INSUFFICIENT_DATA");
    expect(validateReportIntegrity(c.report!)).toEqual([]);
  });
});
