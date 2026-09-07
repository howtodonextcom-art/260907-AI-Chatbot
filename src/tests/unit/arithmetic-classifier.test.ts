import { describe, expect, it } from "vitest";
import {
  computeCoverage,
  findArithmeticCandidate,
  isStrictArithmeticGrammar,
} from "@/ai/orchestration/arithmetic-classifier";

describe("findArithmeticCandidate — identifier safety (v13 §14-16, §41)", () => {
  const rejectedIdentifiers = [
    "MT4/MT5",
    "H264/H265",
    "4K/8K",
    "v1/v2",
    "ISO27001/27002",
    "A/B",
    "IPv4/IPv6",
    "USB2/USB3",
    "Gen4/Gen5",
  ];

  it.each(rejectedIdentifiers)("rejects %s as arithmetic", (text) => {
    expect(findArithmeticCandidate(text)).toBeNull();
  });

  it("rejects MT4/MT5 embedded in a real FTMO question", () => {
    const candidate = findArithmeticCandidate(
      "Should FTMO data import use MT4/MT5 upload or API?"
    );
    expect(candidate).toBeNull();
  });

  it("accepts 4/5 as arithmetic", () => {
    const candidate = findArithmeticCandidate("4/5");
    expect(candidate).not.toBeNull();
    expect(candidate?.normalizedInput).toBe("4/5");
  });

  it("accepts 20*15 as arithmetic", () => {
    const candidate = findArithmeticCandidate("20*15");
    expect(candidate).not.toBeNull();
    expect(candidate?.normalizedInput).toBe("20*15");
  });

  it("accepts a compound claim's numeric fragment (20 users x $15)", () => {
    const candidate = findArithmeticCandidate(
      "20 users x $15/month = $300 MRR and they will all subscribe"
    );
    expect(candidate).not.toBeNull();
    expect(candidate?.normalizedInput).toBe("20*15");
  });

  it("accepts percentage-adjacent numbers", () => {
    const candidate = findArithmeticCandidate("50% + 30%");
    expect(candidate).not.toBeNull();
  });

  it("returns null for non-arithmetic prose with no digit pairs", () => {
    expect(findArithmeticCandidate("Trader thường thất bại do kỷ luật.")).toBeNull();
  });
});

describe("computeCoverage (v13 §17-18)", () => {
  it("returns FULL when the fragment is essentially the whole claim", () => {
    const candidate = findArithmeticCandidate("20*15")!;
    expect(computeCoverage("20*15", candidate)).toBe("FULL");
  });

  it("returns PARTIAL when the fragment is a clause inside a compound claim", () => {
    const claim = "20 users x $15/month = $300 MRR and they will all subscribe";
    const candidate = findArithmeticCandidate(claim)!;
    expect(computeCoverage(claim, candidate)).toBe("PARTIAL");
  });
});

describe("isStrictArithmeticGrammar (v13 §16)", () => {
  it("accepts digits/operators/parens/whitespace/percent", () => {
    expect(isStrictArithmeticGrammar("20 * 15")).toBe(true);
    expect(isStrictArithmeticGrammar("(4 + 5) / 2")).toBe(true);
    expect(isStrictArithmeticGrammar("50%")).toBe(true);
  });

  it("rejects letters", () => {
    expect(isStrictArithmeticGrammar("MT4/MT5")).toBe(false);
    expect(isStrictArithmeticGrammar("20 users")).toBe(false);
  });
});
