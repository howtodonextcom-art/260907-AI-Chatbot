import { describe, expect, it } from "vitest";
import {
  mintHumanApproveProof,
  verifyHumanApproveProof,
} from "@/infrastructure/api/human-approve-proof";
import { AppError } from "@/infrastructure/api/errors";

describe("human approve proof (V4 Client-Asserted Origin Bypass)", () => {
  it("accepts server-minted proof for matching uid/session/draft", () => {
    const proof = mintHumanApproveProof({
      uid: "user-a",
      sessionId: "sess-1",
      judgeRunId: "run-1",
    });
    expect(() =>
      verifyHumanApproveProof({
        proof,
        uid: "user-a",
        sessionId: "sess-1",
        judgeRunId: "run-1",
      })
    ).not.toThrow();
  });

  it("rejects forged / mismatched proof", () => {
    const proof = mintHumanApproveProof({
      uid: "user-a",
      sessionId: "sess-1",
      judgeRunId: "run-1",
    });
    expect(() =>
      verifyHumanApproveProof({
        proof,
        uid: "attacker",
        sessionId: "sess-1",
        judgeRunId: "run-1",
      })
    ).toThrow(AppError);

    expect(() =>
      verifyHumanApproveProof({
        proof: "not-valid-base64url-json!!!!",
        uid: "user-a",
        sessionId: "sess-1",
        judgeRunId: "run-1",
      })
    ).toThrow(AppError);
  });
});
