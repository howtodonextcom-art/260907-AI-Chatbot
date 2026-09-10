import type { ToolConnector } from "@/tools/connector";
import { TOOL_ACTION_PERMISSIONS } from "@/tools/connector";
import { AppError } from "@/infrastructure/api/errors";

const CalculatorConnector: ToolConnector = {
  id: "calculator",
  name: "Calculator",
  capabilities: ["evaluate"],
  async execute(action, input) {
    if (action !== "evaluate") {
      return { success: false, error: `Unknown action: ${action}` };
    }
    const expression = String(
      (input as { expression?: string }).expression ?? ""
    );
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      return { success: false, error: "Invalid expression" };
    }
    try {
      // Controlled arithmetic only (validated charset above)
      const value = Function(`"use strict"; return (${expression});`)() as number;
      return { success: true, output: { value } as never };
    } catch {
      return { success: false, error: "Evaluation failed" };
    }
  },
};

const StatsConnector: ToolConnector = {
  id: "stats",
  name: "Descriptive statistics",
  capabilities: ["describe"],
  async execute(action, input) {
    if (action !== "describe") {
      return { success: false, error: `Unknown action: ${action}` };
    }
    const values = (input as { values?: unknown }).values;
    if (
      !Array.isArray(values) ||
      values.length < 2 ||
      !values.every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      return {
        success: false,
        error: "values must be an array of at least 2 finite numbers",
      };
    }
    const nums = values as number[];
    const count = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const sumSquaredDiff = nums.reduce((a, v) => a + (v - mean) ** 2, 0);
    // Report both conventions rather than guessing whether the caller's
    // dataset is a full population or a sample — a wrong denominator choice
    // silently mislabeled as "the" standard deviation would be exactly the
    // kind of overclaim this tool must not make.
    const populationStdev = Math.sqrt(sumSquaredDiff / count);
    const sampleStdev =
      count > 1 ? Math.sqrt(sumSquaredDiff / (count - 1)) : null;
    return {
      success: true,
      output: {
        count,
        sum,
        mean,
        min: Math.min(...nums),
        max: Math.max(...nums),
        populationStdev,
        sampleStdev,
      } as never,
    };
  },
};

const CONNECTORS: Record<string, ToolConnector> = {
  calculator: CalculatorConnector,
  stats: StatsConnector,
};

export function getToolConnector(id: string): ToolConnector {
  const connector = CONNECTORS[id];
  if (!connector) {
    throw new AppError("VALIDATION_ERROR", `Unknown tool connector: ${id}`, 400);
  }
  return connector;
}

export function assertToolAllowed(connectorId: string, action: string): void {
  const key = `${connectorId}.${action}`;
  const permission = TOOL_ACTION_PERMISSIONS[key];
  if (!permission) {
    throw new AppError(
      "FORBIDDEN",
      `Tool action not allowlisted: ${key}`,
      403
    );
  }
  if (permission !== "READ") {
    throw new AppError(
      "FORBIDDEN",
      "MVP only allows READ tool connector actions",
      403
    );
  }
}

export function listToolConnectors(): ToolConnector[] {
  return Object.values(CONNECTORS);
}
