import { v4 as uuidv4 } from "uuid";
import type { DecisionSession } from "@/domain/decision/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import { toolCalculationDefaults } from "@/domain/evidence/trust";
import type { DomainPack } from "@/domain-packs/generic";
import { assertToolAllowed, getToolConnector } from "@/tools/registry";
import {
  computeCoverage,
  findArithmeticCandidate,
} from "@/ai/orchestration/arithmetic-classifier";

export interface VerifySseEvent {
  event: "tool.started" | "tool.completed" | "run.partial";
  data: Record<string, unknown>;
}

export interface VerifyPipelineResult {
  events: VerifySseEvent[];
  evidence: EvidenceItem[];
  sessionPatch: Partial<DecisionSession>;
  stopReason: "ENOUGH_EVIDENCE" | "NOT_VERIFIABLE" | "EXPERIMENT_REQUIRED" | null;
}

export async function runVerifyPipeline(args: {
  session: DecisionSession;
  ownerId: string;
  domainPack: DomainPack;
}): Promise<VerifyPipelineResult> {
  const allowed = new Set(args.domainPack.getToolConnectorIds?.() ?? []);
  const events: VerifySseEvent[] = [];
  const created: EvidenceItem[] = [];
  const assumptions = args.session.assumptions.map((a) => ({ ...a }));
  const unknowns = args.session.unknowns.map((u) => ({ ...u }));
  const now = new Date().toISOString();

  if (!allowed.has("calculator")) {
    events.push({
      event: "run.partial",
      data: {
        code: "NOT_VERIFIABLE",
        message:
          "No allowlisted VERIFY tools for this DomainPack. Claims remain UNVERIFIED.",
      },
    });
    return {
      events,
      evidence: created,
      sessionPatch: {},
      stopReason: "NOT_VERIFIABLE",
    };
  }

  const claims: Array<{
    kind: "assumption" | "unknown";
    id: string;
    text: string;
  }> = [
    ...assumptions.map((a) => ({
      kind: "assumption" as const,
      id: a.id,
      text: a.statement,
    })),
    ...unknowns.map((u) => ({
      kind: "unknown" as const,
      id: u.id,
      text: u.question,
    })),
  ];

  let verified = 0;
  for (const claim of claims) {
    // Classify BEFORE extraction: "MT4/MT5", "H264/H265", "v1/v2" etc. must
    // never reach the calculator as if they were division — see
    // arithmetic-classifier.ts and CLAUDE.md [[ftmo-verify-classifier]].
    const candidate = findArithmeticCandidate(claim.text);
    if (!candidate) continue;

    const expression = candidate.normalizedInput;
    events.push({
      event: "tool.started",
      data: {
        connectorId: "calculator",
        action: "evaluate",
        expression,
        claimId: claim.id,
      },
    });

    try {
      assertToolAllowed("calculator", "evaluate");
      const connector = getToolConnector("calculator");
      const result = await connector.execute("evaluate", { expression });
      events.push({
        event: "tool.completed",
        data: {
          connectorId: "calculator",
          action: "evaluate",
          success: result.success,
          output: result.output,
          error: result.error,
        },
      });
      if (!result.success) continue;

      const value = (result.output as { value?: number } | undefined)?.value;
      const trust = toolCalculationDefaults();
      const coverage = computeCoverage(claim.text, candidate);
      const item: EvidenceItem = {
        id: uuidv4(),
        workspaceId: args.session.workspaceId,
        sessionId: args.session.id,
        ownerId: args.ownerId,
        type: "CALCULATION",
        claim: `${expression} = ${value}`,
        source: "calculator.evaluate",
        reliability: trust.reliability,
        createdBy: trust.createdBy,
        supportsOptionIds: [],
        contradictsOptionIds: [],
        supportsAssumptionIds: claim.kind === "assumption" ? [claim.id] : [],
        supportsUnknownIds: claim.kind === "unknown" ? [claim.id] : [],
        verificationStatus: trust.verificationStatus,
        verifiedBy: trust.verifiedBy,
        verifiedAt: now,
        verificationMethod: "calculator.evaluate",
        originalClaim: claim.text,
        verifiedFragment: candidate.verifiedFragment,
        verificationCoverage: coverage,
        metadata: { expression, value },
        createdAt: now,
      };
      created.push(item);
      verified += 1;

      // Only a FULL-coverage calculation may flip status: a PARTIAL
      // calculation (e.g. "20 x 15" inside a compound claim about MRR and
      // adoption) still attaches as evidence but must not be reported as
      // having verified the whole proposition — see §17-19.
      if (claim.kind === "assumption") {
        const target = assumptions.find((a) => a.id === claim.id);
        if (target) {
          target.evidenceIds = [...target.evidenceIds, item.id];
          if (coverage === "FULL") {
            target.status = "SUPPORTED";
          }
        }
      } else {
        const target = unknowns.find((u) => u.id === claim.id);
        if (target) {
          target.evidenceIds = [...target.evidenceIds, item.id];
          if (coverage === "FULL") {
            target.resolution = "RESOLVED";
          }
        }
      }
    } catch (error) {
      events.push({
        event: "tool.completed",
        data: {
          connectorId: "calculator",
          action: "evaluate",
          success: false,
          error: error instanceof Error ? error.message : "tool failed",
        },
      });
    }
  }

  if (verified === 0) {
    const experiment = unknowns.some((u) => u.resolution === "EXPERIMENT_REQUIRED");
    return {
      events,
      evidence: created,
      sessionPatch: { assumptions, unknowns },
      stopReason: experiment ? "EXPERIMENT_REQUIRED" : "NOT_VERIFIABLE",
    };
  }

  return {
    events,
    evidence: created,
    sessionPatch: { assumptions, unknowns },
    stopReason: "ENOUGH_EVIDENCE",
  };
}
