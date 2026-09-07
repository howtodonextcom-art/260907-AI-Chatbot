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

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const REQUEST_TIMEOUT_MS = 60_000;

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

function mapRole(role: string): ChatRole {
  if (role === "assistant") return "assistant";
  if (role === "system") return "system";
  return "user";
}

function buildMessages(request: NormalizedModelRequest): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: request.systemInstructions },
    ...request.messages.map((m) => ({
      role: mapRole(m.role),
      content: m.content,
    })),
  ];

  if (request.outputSchemaName) {
    messages.push({
      role: "system",
      content: `Respond with valid JSON only matching schema: ${request.outputSchemaName}`,
    });
  }

  return messages;
}

export class DeepSeekProvider implements ModelProvider {
  id = "deepseek";
  private modelName = getDefaultModel("deepseek");

  capabilities(): ModelCapabilities {
    return {
      structuredOutput: true,
      tools: false,
      streaming: true,
      vision: false,
      maxContextTokens: 128_000,
    };
  }

  private apiKey(): string {
    const key = getServerEnv().DEEPSEEK_API_KEY;
    if (!key) {
      throw new AppError("PROVIDER_ERROR", "DEEPSEEK_API_KEY missing", 502);
    }
    return key;
  }

  private async chatCompletions(body: Record<string, unknown>): Promise<Response> {
    try {
      return await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" ||
          error.name === "AbortError" ||
          /timeout|timed out|aborted/i.test(error.message))
      ) {
        throw new AppError("PROVIDER_TIMEOUT", "DeepSeek request timed out", 504);
      }
      throw new AppError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "DeepSeek network error",
        502
      );
    }
  }

  async generate<T = unknown>(
    request: NormalizedModelRequest
  ): Promise<ModelResult<T>> {
    const started = Date.now();
    try {
      const response = await this.chatCompletions({
        model: this.modelName,
        messages: buildMessages(request),
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature ?? 0.4,
        response_format: request.outputSchemaName
          ? { type: "json_object" }
          : undefined,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AppError(
          "PROVIDER_ERROR",
          `DeepSeek HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
          502
        );
      }

      const completion = (await response.json()) as ChatCompletionResponse;
      const content = completion.choices?.[0]?.message?.content ?? "";
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
        error instanceof Error ? error.message : "DeepSeek error",
        502
      );
    }
  }

  async *stream(
    request: NormalizedModelRequest
  ): AsyncIterable<ModelStreamEvent> {
    const started = Date.now();
    try {
      const response = await this.chatCompletions({
        model: this.modelName,
        stream: true,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature ?? 0.4,
        messages: [
          { role: "system", content: request.systemInstructions },
          ...request.messages.map((m) => ({
            role: mapRole(m.role === "system" ? "user" : m.role),
            content: m.content,
          })),
        ],
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        yield {
          type: "error",
          error: `DeepSeek stream HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) {
              full += text;
              yield { type: "token", text };
            }
          } catch {
            // ignore malformed SSE chunks
          }
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
        error: error instanceof Error ? error.message : "DeepSeek stream error",
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
