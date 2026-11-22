// The dashboard of the manager of the warehouses and purchasing (one answer from /api/admin/inventory/dashboard/manager)

export interface MgrItem { variantId: number; productName: string; label: string; sku: string; units: number; value: number; imageUrl: string | null; }
export interface MgrPurchaseOrders { draft: number; sent: number; partiallyReceived: number; received: number; cancelled: number; late: number; }
export interface MgrLateOrder { id: number; number: string; supplier: string; warehouse: string; expectedAtUtc: string; daysLate: number; unitsLeft: number; }
export interface MgrOperations {
  receiptsPending: number; issuesPending: number;
  transfersRequested: number; transfersApproved: number; transfersInTransit: number;
  adjustmentsPending: number; countAdjustmentsPending: number; countsOpen: number;
  supplierReturnsPending: number; supplierReturnsDone: number; customerReturnsPending: number; customerReturnsDone: number;
}
export interface MgrSupplier { supplierId: number; name: string; orders: number; value: number; }
export interface MgrSupplierPerformance { supplierId: number; name: string; orders: number; onTime: number; onTimePercent: number; }
export interface MgrReorder {
  variantId: number; warehouseId: number; warehouseName: string; productName: string; label: string; sku: string; imageUrl: string | null;
  onHand: number; reorderLevel: number; incoming: number; suggestedQuantity: number; supplierId: number | null; supplierName: string | null; unitCost: number;
}
export interface MgrLowStock { warehouseName: string; productName: string; label: string; sku: string; onHand: number; reorderLevel: number; }
export interface MgrExpiring { warehouseName: string; productName: string; label: string; batchNumber: string; remaining: number; expiryDate: string; daysToExpiry: number; }

export interface InventoryManagerDashboard {
  days: number;
  stockValue: number; itemsInStock: number; lowStockItems: number; outOfStockItems: number; openPurchaseOrders: number; pendingTransfers: number;
  purchasesValue: number; purchaseOrdersInPeriod: number;
  totalUnits: number; reservedUnits: number; availableUnits: number;
  stagnantDays: number; stagnantItems: number; stagnantValue: number; stagnant: MgrItem[];
  topMoving: MgrItem[];
  damagedUnits: number; damagedValue: number; damaged: MgrItem[];
  expiringSoon: number; expired: number; expiring: MgrExpiring[];
  lowStock: MgrLowStock[];
  purchaseOrders: MgrPurchaseOrders; lateOrders: MgrLateOrder[];
  operations: MgrOperations;
  topSuppliers: MgrSupplier[]; performance: MgrSupplierPerformance[]; unreceivedOrders: number; unreceivedUnits: number;
  reorder: MgrReorder[]; reorderTotal: number;
}
