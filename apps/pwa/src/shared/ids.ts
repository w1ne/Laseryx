let requestCounter = 0;

export function createRequestId(): string {
  requestCounter += 1;
  return `req-${Date.now()}-${requestCounter}`;
}
