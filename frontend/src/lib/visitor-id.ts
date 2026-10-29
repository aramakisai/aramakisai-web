const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isVisitorId = (v: unknown): v is string =>
  typeof v === 'string' && UUID_V4.test(v);
