export function logStructured(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>
): void {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
