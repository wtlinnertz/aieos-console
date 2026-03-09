const SECRET_PATTERNS: RegExp[] = [
  /api_?key/i,
  /secret/i,
  /password/i,
  /credential/i,
  /^token$/i,
  /[\b_.]token$/i,
  /^token[\b_.]/i,
  /auth.*token/i,
  /user.*token/i,
  /llm_api_key/i,
];

function isSecretField(fieldName: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(fieldName));
}

function redactValue(key: string, value: unknown): unknown {
  if (isSecretField(key)) {
    return '[REDACTED]';
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

function redactObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = redactValue(key, value);
  }
  return result;
}

export function log(
  level: 'INFO' | 'ERROR',
  event: string,
  context?: Record<string, unknown>,
): void {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    event,
  };

  if (context) {
    const redacted = redactObject(context);
    Object.assign(entry, redacted);
  }

  process.stdout.write(JSON.stringify(entry) + '\n');
}

export function logInfo(
  event: string,
  context?: Record<string, unknown>,
): void {
  log('INFO', event, context);
}

export function logError(
  event: string,
  context?: Record<string, unknown>,
): void {
  log('ERROR', event, context);
}
