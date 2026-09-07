import { z } from "zod";

export const ChallengeReadyAnalystSchema = z.object({
  problemFraming: z.string(),
  assumptions: z.array(z.string()),
  options: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      risks: z.array(z.string()),
    })
  ),
  tradingSafetyNote: z.string(),
});
