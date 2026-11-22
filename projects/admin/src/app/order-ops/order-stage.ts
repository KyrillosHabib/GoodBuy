// One word for "where the order stands": the order status and the preparation status told as a single stage.
// Before shipping, the stage is the preparation status (needs a warehouse, being prepared, ready to ship...).
// From shipping on, it is the order status (shipped, delivered, cancelled).
export function stageKey(status: string, fulfilment?: string | null): string {
  if ((status === 'Confirmed' || status === 'Processing') && fulfilment && fulfilment !== 'NotRequired') return 'ful.s.' + fulfilment;
  return 'order.status.' + status;
}

export function stageClass(status: string, fulfilment?: string | null): string {
  if (status === 'Cancelled') return 'fs-Problem';
  if (status === 'Delivered') return 'fs-ReadyToShip';
  if (status === 'Shipped') return 'fs-Shipped';
  if (status === 'Pending') return 'fs-NeedsAllocation';
  if ((status === 'Confirmed' || status === 'Processing') && fulfilment) return 'fs-' + fulfilment;
  return '';
}
