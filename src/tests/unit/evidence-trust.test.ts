import { describe, expect, it } from "vitest";
import { userEvidenceDefaults, toolCalculationDefaults } from "@/domain/evidence/trust";
import { CreateEvidenceSchema } from "@/domain/decision/schemas";

describe("evidence trust", () => {
  it("user submissions stay UNVERIFIED even for OFFICIAL_DOCUMENTATION", () => {
    const d = userEvidenceDefaults("OFFICIAL_DOCUMENTATION");
    expect(d.verificationStatus).toBe("UNVERIFIED");
    expect(d.createdBy).toBe("USER");
    expect(d.reliability).not.toBe("HIGH");
  });

  it("calculator results are VERIFIED by TOOL", () => {
    const d = toolCalculationDefaults();
    expect(d.verificationStatus).toBe("VERIFIED");
    expect(d.createdBy).toBe("TOOL");
    expect(d.verifiedBy).toBe("TOOL");
    expect(d.reliability).toBe("HIGH");
  });

  it("client reliability field is optional and ignored by schema defaulting", () => {
    const parsed = CreateEvidenceSchema.parse({
      type: "OFFICIAL_DOCUMENTATION",
      claim: "Firebase is required for this MVP",
      reliability: "HIGH",
    });
    expect(parsed.reliability).toBe("HIGH");
    const trust = userEvidenceDefaults(parsed.type);
    expect(trust.reliability).toBe("MEDIUM");
    expect(trust.verificationStatus).toBe("UNVERIFIED");
  });
});
