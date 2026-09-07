import { GoogleGenerativeAI } from "@google/generative-ai";
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

export class GeminiProvider implements ModelProvider {
  id = "gemini";
  private modelName = getDefaultModel("gemini");

  capabilities(): ModelCapabilities {
    return {
      structuredOutput: true,
      tools: true,
      streaming: true,
      vision: true,
      maxContextTokens: 1_000_000,
    };
  }

  private client() {
    const key = getServerEnv().GEMINI_API_KEY;
    if (!key) {
      throw new AppError("PROVIDER_ERROR", "GEMINI_API_KEY missing", 502);
    }
    return new GoogleGenerativeAI(key);
  }

  async generate<T = unknown>(
    request: NormalizedModelRequest
  ): Promise<ModelResult<T>> {
    const started = Date.now();
    try {
      const model = this.client().getGenerativeModel({
        model: this.modelName,
        systemInstruction: request.systemInstructions,
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
          temperature: request.temperature ?? 0.4,
          responseMimeType: request.outputSchemaName
            ? "application/json"
            : "text/plain",
        },
      });

      const contents = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const result = await model.generateContent({ contents });
      const content = result.response.text();
      const usageMeta = result.response.usageMetadata;
      const inputTokens = usageMeta?.promptTokenCount;
      const outputTokens = usageMeta?.candidatesTokenCount;
      const latencyMs = Date.now() - started;

      let structured: T | undefined;
      if (request.outputSchemaName) {
        try {
          structured = JSON.parse(content) as T;
        } catch {
          // repair handled by caller
        }
      }

      return {
        provider: this.id,
        model: this.modelName,
        content,
        structured,
        usage: { inputTokens, outputTokens },
        latencyMs,
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
        error instanceof Error ? error.message : "Gemini error",
        502
      );
    }
  }

  async *stream(
    request: NormalizedModelRequest
  ): AsyncIterable<ModelStreamEvent> {
    const started = Date.now();
    try {
      const model = this.client().getGenerativeModel({
        model: this.modelName,
        systemInstruction: request.systemInstructions,
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
          temperature: request.temperature ?? 0.4,
        },
      });
      const contents = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const streaming = await model.generateContentStream({ contents });
      let full = "";
      for await (const chunk of streaming.stream) {
        const text = chunk.text();
        if (text) {
          full += text;
          yield { type: "token", text };
        }
      }
      const aggregated = await streaming.response;
      const usageMeta = aggregated.usageMetadata;
      yield {
        type: "done",
        result: {
          provider: this.id,
          model: this.modelName,
          content: full,
          usage: {
            inputTokens: usageMeta?.promptTokenCount,
            outputTokens: usageMeta?.candidatesTokenCount,
          },
          latencyMs: Date.now() - started,
          estimatedCostUsd: estimateCostUsd(
            this.id,
            this.modelName,
            usageMeta?.promptTokenCount,
            usageMeta?.candidatesTokenCount
          ),
        },
      };
    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Gemini stream error",
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
