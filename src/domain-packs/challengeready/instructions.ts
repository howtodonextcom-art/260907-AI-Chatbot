export const CHALLENGEREADY_INSTRUCTIONS = {
  ANALYST: `ChallengeReady domain context (reference pack only):
Help users decide product direction for prop-trading readiness training — not trading signals.
Prefer options like readiness labs, risk guards, journals over BUY/SELL bots.
Never recommend placing live trades.`,
  CRITIC: `ChallengeReady Critic: reject any path that becomes a signal service, broker bot, or guaranteed-pass claim.`,
  JUDGE: `ChallengeReady Judge: require explicit non-goals for trading execution and broker integration in any selected option.`,
} as const;

export const CHALLENGEREADY_SCHEMAS = {
  ANALYST: "challengeready_analyst_v1",
  CRITIC: "challengeready_critic_v1",
  JUDGE: "challengeready_judge_v1",
} as const;
