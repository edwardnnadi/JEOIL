import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Reference numbers are allocated by the server. Nothing here accepts a
 * hand-typed batch, order or dispatch number, which is how the "JEO-TarOO1"
 * transcription error reached the source spreadsheets unnoticed.
 */
export const idSequences = sqliteTable('id_sequences', {
  key: text('key').primaryKey(),
  prefix: text('prefix').notNull(),
  nextValue: integer('next_value').notNull().default(1),
  padding: integer('padding').notNull().default(4),
});

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    suppliedItems: text('supplied_items').notNull().default('[]'),
    status: text('status').notNull().default('ACTIVE'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('supplier_status_idx').on(table.status, table.name)],
);

export const purchaseOrders = sqliteTable(
  'purchase_orders',
  {
    id: text('id').primaryKey(),
    poNumber: text('po_number').notNull().unique(),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    status: text('status').notNull().default('DRAFT'),
    currency: text('currency').notNull().default('NGN'),
    orderDate: integer('order_date', { mode: 'timestamp_ms' }).notNull(),
    expectedDate: integer('expected_date', { mode: 'timestamp_ms' }),
    totalAmount: real('total_amount').notNull().default(0),
    notes: text('notes'),
    raisedBy: text('raised_by').notNull(),
    approvedBy: text('approved_by'),
    approvedAt: integer('approved_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('purchase_order_status_idx').on(table.status, table.orderDate)],
);

export const purchaseOrderLines = sqliteTable(
  'purchase_order_lines',
  {
    id: text('id').primaryKey(),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    itemName: text('item_name').notNull(),
    itemCategory: text('item_category'),
    unit: text('unit').notNull(),
    quantityOrdered: real('quantity_ordered').notNull(),
    quantityReceived: real('quantity_received').notNull().default(0),
    unitPrice: real('unit_price').notNull().default(0),
  },
  (table) => [index('purchase_order_line_order_idx').on(table.purchaseOrderId)],
);

export const goodsReceipts = sqliteTable(
  'goods_receipts',
  {
    id: text('id').primaryKey(),
    grnNumber: text('grn_number').notNull().unique(),
    purchaseOrderId: text('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    purchaseOrderLineId: text('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLines.id),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    itemName: text('item_name').notNull(),
    unit: text('unit').notNull(),
    quantityReceived: real('quantity_received').notNull(),
    warehouse: text('warehouse'),
    vehicleRef: text('vehicle_ref'),
    waybillRef: text('waybill_ref'),
    qcStatus: text('qc_status').notNull().default('PENDING'),
    qcTestResultId: text('qc_test_result_id'),
    receivedBy: text('received_by').notNull(),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('goods_receipt_qc_idx').on(table.qcStatus, table.receivedAt)],
);

/**
 * Raw material stock exists only as the downstream half of an accepted goods
 * receipt: the batch row is created in the same write that records an ACCEPT.
 * No code path builds a batch from a rejected receipt, so a warehouse screen
 * has nothing to intake when QC rejects.
 */
export const rawMaterialBatches = sqliteTable(
  'raw_material_batches',
  {
    id: text('id').primaryKey(),
    batchNumber: text('batch_number').notNull().unique(),
    goodsReceiptId: text('goods_receipt_id')
      .notNull()
      .unique()
      .references(() => goodsReceipts.id),
    itemName: text('item_name').notNull(),
    unit: text('unit').notNull(),
    quantityReceived: real('quantity_received').notNull(),
    quantityRemaining: real('quantity_remaining').notNull(),
    warehouse: text('warehouse'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('raw_material_batch_item_idx').on(table.itemName)],
);

/**
 * A finished batch starts life in QUARANTINE. Only a FINAL-stage QC PASS moves
 * it to RELEASED, and only a RELEASED batch can be dispatched.
 */
export const finishedGoodsBatches = sqliteTable(
  'finished_goods_batches',
  {
    id: text('id').primaryKey(),
    batchNumber: text('batch_number').notNull().unique(),
    productName: text('product_name').notNull(),
    unit: text('unit').notNull(),
    quantityProduced: real('quantity_produced').notNull(),
    quantityRemaining: real('quantity_remaining').notNull(),
    productionRunRef: text('production_run_ref'),
    status: text('status').notNull().default('QUARANTINE'),
    qcTestResultId: text('qc_test_result_id'),
    releasedBy: text('released_by'),
    releasedAt: integer('released_at', { mode: 'timestamp_ms' }),
    producedBy: text('produced_by').notNull(),
    producedAt: integer('produced_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('finished_goods_status_idx').on(table.status, table.productName)],
);

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    status: text('status').notNull().default('ACTIVE'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('customer_status_idx').on(table.status, table.name)],
);

export const salesOrders = sqliteTable(
  'sales_orders',
  {
    id: text('id').primaryKey(),
    soNumber: text('so_number').notNull().unique(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    status: text('status').notNull().default('DRAFT'),
    currency: text('currency').notNull().default('NGN'),
    orderDate: integer('order_date', { mode: 'timestamp_ms' }).notNull(),
    requiredDate: integer('required_date', { mode: 'timestamp_ms' }),
    totalAmount: real('total_amount').notNull().default(0),
    notes: text('notes'),
    raisedBy: text('raised_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('sales_order_status_idx').on(table.status, table.orderDate)],
);

export const salesOrderLines = sqliteTable(
  'sales_order_lines',
  {
    id: text('id').primaryKey(),
    salesOrderId: text('sales_order_id')
      .notNull()
      .references(() => salesOrders.id),
    productName: text('product_name').notNull(),
    unit: text('unit').notNull(),
    quantityOrdered: real('quantity_ordered').notNull(),
    quantityDispatched: real('quantity_dispatched').notNull().default(0),
    unitPrice: real('unit_price').notNull().default(0),
  },
  (table) => [index('sales_order_line_order_idx').on(table.salesOrderId)],
);

export const dispatches = sqliteTable(
  'dispatches',
  {
    id: text('id').primaryKey(),
    dispatchNumber: text('dispatch_number').notNull().unique(),
    salesOrderId: text('sales_order_id')
      .notNull()
      .references(() => salesOrders.id),
    salesOrderLineId: text('sales_order_line_id')
      .notNull()
      .references(() => salesOrderLines.id),
    finishedGoodsBatchId: text('finished_goods_batch_id')
      .notNull()
      .references(() => finishedGoodsBatches.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    vehicleRef: text('vehicle_ref'),
    driverName: text('driver_name'),
    dispatchedBy: text('dispatched_by').notNull(),
    dispatchedAt: integer('dispatched_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('dispatch_order_idx').on(table.salesOrderId, table.dispatchedAt)],
);
