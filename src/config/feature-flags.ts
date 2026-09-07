import { getServerEnv } from "@/config/env";

export function getFeatureFlags() {
  const env = getServerEnv();
  return {
    enableCritic: env.enableCritic,
    enableJudge: env.enableJudge,
    enableChallengeReadyPack: env.enableChallengeReadyPack,
  };
}
