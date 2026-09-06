import { describe, expect, it } from "vitest";
import { classifyMaterialChange, fingerprint, inspectSources, normalizeContent, normalizeOfficialUrl } from "../../packages/tax-irs-monitor/src/monitor.mjs";

describe("ATLAS Tax IRS monitor", () => {
  it("accepts only official HTTPS IRS sources", () => {
    expect(normalizeOfficialUrl("https://www.irs.gov/newsroom")).toBe("https://www.irs.gov/newsroom");
    expect(() => normalizeOfficialUrl("http://irs.gov/newsroom")).toThrow(/rejected/);
    expect(() => normalizeOfficialUrl("https://irs.gov.example.com/newsroom")).toThrow(/rejected/);
  });

  it("normalizes non-semantic HTML before hashing", () => {
    expect(normalizeContent("<style>x</style><main> Tax   year </main>")).toBe("Tax year");
    expect(fingerprint("<p>Tax year</p>")).toBe(fingerprint(" Tax   year "));
  });

  it("bootstraps without creating a false alert", async () => {
    const fetchImpl = async () => new Response("<main>New Form 1040 instructions</main>", { status: 200 });
    const result = await inspectSources({
      sources: [{ id: "forms", title: "Forms", category: "forms", url: "https://www.irs.gov/forms" }],
      fetchImpl,
      now: new Date("2026-09-06T12:00:00Z")
    });
    expect(result.changes).toEqual([]);
  });

  it("maps a changed filing deadline to the affected workflow", () => {
    const classification = classifyMaterialChange(
      { digest: "old" },
      { digest: "new", title: "Deadline notice", text: "The filing due date and disaster relief changed." }
    );
    expect(classification.material).toBe(true);
    expect(classification.workflows).toContain("filing-and-payment-deadlines");
  });
});
