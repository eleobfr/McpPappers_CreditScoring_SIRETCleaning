type LogLevel = "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

export function logEvent(
  level: LogLevel,
  event: string,
  payload: Record<string, unknown> = {},
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        value instanceof Error ? serializeError(value) : value,
      ]),
    ),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}
