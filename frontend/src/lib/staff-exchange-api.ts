export const cancelExchangeRequest = (exchangeId: number): Promise<Response> =>
  fetch(`/api/staff/exchanges/${exchangeId}/cancel`, { method: 'POST' });
