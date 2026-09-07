import Groq from "groq-sdk";
import { getServerEnv } from "@/config/env";
import type {
  ModelCapabilities,
  ModelProvider,
  ModelResult,
  ModelStreamEvent,
  NormalizedModelRequest,
} from "@/ai/gateway/model-provider";
import {
  estimateCostUsd,
  getDefaultModel,
} from "@/ai/gateway/model-registry";
import { AppError } from "@/infrastructure/api/errors";

export class GroqProvider implements ModelProvider {
  id = "groq";
  private modelName = getDefaultModel("groq");

  capabilities(): ModelCapabilities {
    return {
      structuredOutput: true,
      tools: false,
      streaming: true,
      vision: false,
      maxContextTokens: 128_000,
    };
  }

  private client() {
    const key = getServerEnv().GROQ_API_KEY;
    if (!key) {
      throw new AppError("PROVIDER_ERROR", "GROQ_API_KEY missing", 502);
    }
    return new Groq({ apiKey: key });
  }

  async generate<T = unknown>(
    request: NormalizedModelRequest
  ): Promise<ModelResult<T>> {
    const started = Date.now();
    try {
      const messages = [
        { role: "system" as const, content: request.systemInstructions },
        ...request.messages.map((m) => ({
          role:
            m.role === "assistant"
              ? ("assistant" as const)
              : m.role === "system"
                ? ("system" as const)
                : ("user" as const),
          content: m.content,
        })),
      ];

      if (request.outputSchemaName) {
        messages.push({
          role: "system",
          content: `Respond with valid JSON only matching schema: ${request.outputSchemaName}`,
        });
      }

      const completion = await this.client().chat.completions.create({
        model: this.modelName,
        messages,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature ?? 0.4,
        response_format: request.outputSchemaName
          ? { type: "json_object" }
          : undefined,
      });

      const content = completion.choices[0]?.message?.content ?? "";
      const inputTokens = completion.usage?.prompt_tokens;
      const outputTokens = completion.usage?.completion_tokens;
      let structured: T | undefined;
      if (request.outputSchemaName) {
        try {
          structured = JSON.parse(content) as T;
        } catch {
          // repair handled upstream
        }
      }

      return {
        provider: this.id,
        model: this.modelName,
        content,
        structured,
        usage: { inputTokens, outputTokens },
        latencyMs: Date.now() - started,
        estimatedCostUsd: estimateCostUsd(
          this.id,
          this.modelName,
          inputTokens,
          outputTokens
        ),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Groq error",
        502
      );
    }
  }

  async *stream(
    request: NormalizedModelRequest
  ): AsyncIterable<ModelStreamEvent> {
    const started = Date.now();
    try {
      const stream = await this.client().chat.completions.create({
        model: this.modelName,
        stream: true,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature ?? 0.4,
        messages: [
          { role: "system", content: request.systemInstructions },
          ...request.messages.map((m) => ({
            role:
              m.role === "assistant"
                ? ("assistant" as const)
                : ("user" as const),
            content: m.content,
          })),
        ],
      });

      let full = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          full += text;
          yield { type: "token", text };
        }
      }
      yield {
        type: "done",
        result: {
          provider: this.id,
          model: this.modelName,
          content: full,
          usage: {},
          latencyMs: Date.now() - started,
        },
      };
    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Groq stream error",
      };
    }
  }

  async health() {
    const started = Date.now();
    try {
      await this.generate({
        role: "ANALYST",
        routeMode: "QUICK",
        systemInstructions: "Reply with OK",
        messages: [{ role: "user", content: "ping" }],
        maxOutputTokens: 8,
        metadata: {
          requestId: "health",
          workspaceId: "n/a",
          sessionId: "n/a",
          promptVersion: "health",
        },
      });
      return { ok: true, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: Date.now() - started };
    }
  }
}
