export class RequestError extends Error {
  constructor(code, status, message) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function jsonError(error, operation) {
  const known = error instanceof RequestError;
  const code = known ? error.code : /^[A-Z0-9]{5}$/.test(error?.code || '') ? error.code : 'UNEXPECTED';
  const status = known ? error.status : 500;
  if (status >= 500) console.error('Request failed', { operation, code });
  return Response.json({
    error: known ? error.message : '요청을 처리하지 못했습니다.',
    code,
  }, { status });
}
