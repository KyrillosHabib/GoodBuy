// The answer of GET inventory/dashboard: the cards, the data of the charts, the lists and the latest activity

export interface InvDashDailyPoint { day: string; unitsIn: number; unitsOut: number; operations: number; }
// A slice: key is a status or a movement type (the screen translates it)
export interface InvDashSlice { key: string; value: number; }
export interface InvDashWarehouse { warehouseId: number; name: string; units: number; value: number; }
export interface InvDashTopItem { variantId: number; productName: string; label: string; sku: string; units: number; imageUrl: string | null; price: number; }
export interface InvDashLowStock { warehouseName: string; productName: string; label: string; sku: string; onHand: number; reorderLevel: number; }
export interface InvDashExpiring { warehouseName: string; productName: string; label: string; batchNumber: string; remaining: number; expiryDate: string; daysToExpiry: number; }
export interface InvDashActivity { atUtc: string; type: string; quantity: number; warehouseName: string; productName: string; label: string; userName: string | null; reference: string | null; imageUrl: string | null; }

export interface InventoryDashboard {
  days: number;
  totalUnits: number;
  totalValue: number;
  items: number;
  warehouses: number;
  lowStockItems: number;
  expiringSoonBatches: number;
  expiredBatches: number;
  reservedUnits: number;
  openPurchaseOrders: number;
  transfersToApprove: number;
  transfersInTransit: number;
  unitsInPeriod: number;
  unitsOutPeriod: number;
  operationsInPeriod: number;
  // the same totals for the period just before
  prevUnitsIn: number;
  prevUnitsOut: number;
  prevOperations: number;
  daily: InvDashDailyPoint[];
  byWarehouse: InvDashWarehouse[];
  movementsByType: InvDashSlice[];
  purchaseOrdersByStatus: InvDashSlice[];
  transfersByStatus: InvDashSlice[];
  topMoving: InvDashTopItem[];
  lowStock: InvDashLowStock[];
  expiring: InvDashExpiring[];
  recent: InvDashActivity[];
}
