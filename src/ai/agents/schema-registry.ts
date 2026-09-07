import type { ZodType } from "zod";
import {
  AnalystOutputSchema,
  CriticOutputSchema,
  JudgeOutputSchema,
  SecondOpinionOutputSchema,
} from "@/ai/agents/schemas";

/** Maps DomainPack.getOutputSchemaName() values to real Zod schemas. */
export const OUTPUT_SCHEMA_REGISTRY: Record<string, ZodType> = {
  analyst_output_v1: AnalystOutputSchema,
  critic_output_v1: CriticOutputSchema,
  judge_output_v1: JudgeOutputSchema,
  second_opinion_output_v1: SecondOpinionOutputSchema,
};

export function getOutputSchema(name: string): ZodType {
  const schema = OUTPUT_SCHEMA_REGISTRY[name];
  if (!schema) {
    throw new Error(`Unknown output schema: ${name}`);
  }
  return schema;
}

export function isRegisteredOutputSchema(name: string): boolean {
  return Boolean(OUTPUT_SCHEMA_REGISTRY[name]);
}
