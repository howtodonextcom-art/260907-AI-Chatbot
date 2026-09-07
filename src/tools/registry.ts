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

const CONNECTORS: Record<string, ToolConnector> = {
  calculator: CalculatorConnector,
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
