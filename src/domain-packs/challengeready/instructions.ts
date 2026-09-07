export const CHALLENGEREADY_INSTRUCTIONS = {
  ANALYST: `ChallengeReady domain context (reference pack only):
Help users decide product direction for prop-trading readiness training — not trading signals.
Prefer options like readiness labs, risk guards, journals over BUY/SELL bots.
Never recommend placing live trades.`,
  CRITIC: `ChallengeReady Critic: reject any path that becomes a signal service, broker bot, or guaranteed-pass claim.`,
  JUDGE: `ChallengeReady Judge: require explicit non-goals for trading execution and broker integration in any selected option.`,
  SECOND_OPINION: `ChallengeReady Second Opinion: sanity-check the Analyst's direction independently — flag it if it drifts toward signal bots, broker execution, or guaranteed-pass claims.`,
} as const;

export const CHALLENGEREADY_SCHEMAS = {
  ANALYST: "analyst_output_v1",
  CRITIC: "critic_output_v1",
  JUDGE: "judge_output_v1",
  SECOND_OPINION: "second_opinion_output_v1",
} as const;
