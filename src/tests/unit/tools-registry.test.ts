import { describe, expect, it } from "vitest";
import { getToolConnector, assertToolAllowed } from "@/tools/registry";

describe("stats.describe connector", () => {
  it("computes exact count/sum/mean/min/max/stdev for a known dataset", async () => {
    // Population: [2,4,4,4,5,5,7,9] — textbook example, population stdev = 2.
    const connector = getToolConnector("stats");
    const result = await connector.execute("describe", {
      values: [2, 4, 4, 4, 5, 5, 7, 9],
    });
    expect(result.success).toBe(true);
    const out = result.output as {
      count: number;
      sum: number;
      mean: number;
      min: number;
      max: number;
      populationStdev: number;
      sampleStdev: number | null;
    };
    expect(out.count).toBe(8);
    expect(out.sum).toBe(40);
    expect(out.mean).toBe(5);
    expect(out.min).toBe(2);
    expect(out.max).toBe(9);
    expect(out.populationStdev).toBeCloseTo(2, 10);
    expect(out.sampleStdev).toBeCloseTo(2.138089935, 6);
  });

  it("never silently guesses a denominator — reports both population and sample stdev, never a single unlabeled 'stdev'", async () => {
    const connector = getToolConnector("stats");
    const result = await connector.execute("describe", { values: [1, 2, 3] });
    const out = result.output as Record<string, unknown>;
    expect(out).toHaveProperty("populationStdev");
    expect(out).toHaveProperty("sampleStdev");
    expect(out).not.toHaveProperty("stdev");
  });

  it("rejects fewer than 2 values", async () => {
    const connector = getToolConnector("stats");
    const result = await connector.execute("describe", { values: [5] });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric / non-array input rather than throwing", async () => {
    const connector = getToolConnector("stats");
    const result = await connector.execute("describe", {
      values: [1, "two", 3],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown action", async () => {
    const connector = getToolConnector("stats");
    const result = await connector.execute("predict", { values: [1, 2] });
    expect(result.success).toBe(false);
  });

  it("is allowlisted as a READ-only action, same as calculator", () => {
    expect(() => assertToolAllowed("stats", "describe")).not.toThrow();
    expect(() => assertToolAllowed("stats", "write")).toThrow();
  });
});
