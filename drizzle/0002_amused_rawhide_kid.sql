CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`address` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_code_unique` ON `customers` (`code`);--> statement-breakpoint
CREATE INDEX `customer_status_idx` ON `customers` (`status`,`name`);--> statement-breakpoint
CREATE TABLE `dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`dispatch_number` text NOT NULL,
	`sales_order_id` text NOT NULL,
	`sales_order_line_id` text NOT NULL,
	`finished_goods_batch_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`vehicle_ref` text,
	`driver_name` text,
	`dispatched_by` text NOT NULL,
	`dispatched_at` integer NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_order_line_id`) REFERENCES `sales_order_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`finished_goods_batch_id`) REFERENCES `finished_goods_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dispatches_dispatch_number_unique` ON `dispatches` (`dispatch_number`);--> statement-breakpoint
CREATE INDEX `dispatch_order_idx` ON `dispatches` (`sales_order_id`,`dispatched_at`);--> statement-breakpoint
CREATE TABLE `finished_goods_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_number` text NOT NULL,
	`product_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity_produced` real NOT NULL,
	`quantity_remaining` real NOT NULL,
	`production_run_ref` text,
	`status` text DEFAULT 'QUARANTINE' NOT NULL,
	`qc_test_result_id` text,
	`released_by` text,
	`released_at` integer,
	`produced_by` text NOT NULL,
	`produced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finished_goods_batches_batch_number_unique` ON `finished_goods_batches` (`batch_number`);--> statement-breakpoint
CREATE INDEX `finished_goods_status_idx` ON `finished_goods_batches` (`status`,`product_name`);--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`grn_number` text NOT NULL,
	`purchase_order_id` text NOT NULL,
	`purchase_order_line_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity_received` real NOT NULL,
	`warehouse` text,
	`vehicle_ref` text,
	`waybill_ref` text,
	`qc_status` text DEFAULT 'PENDING' NOT NULL,
	`qc_test_result_id` text,
	`received_by` text NOT NULL,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goods_receipts_grn_number_unique` ON `goods_receipts` (`grn_number`);--> statement-breakpoint
CREATE INDEX `goods_receipt_qc_idx` ON `goods_receipts` (`qc_status`,`received_at`);--> statement-breakpoint
CREATE TABLE `id_sequences` (
	`key` text PRIMARY KEY NOT NULL,
	`prefix` text NOT NULL,
	`next_value` integer DEFAULT 1 NOT NULL,
	`padding` integer DEFAULT 4 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`item_name` text NOT NULL,
	`item_category` text,
	`unit` text NOT NULL,
	`quantity_ordered` real NOT NULL,
	`quantity_received` real DEFAULT 0 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchase_order_line_order_idx` ON `purchase_order_lines` (`purchase_order_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`po_number` text NOT NULL,
	`supplier_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`currency` text DEFAULT 'NGN' NOT NULL,
	`order_date` integer NOT NULL,
	`expected_date` integer,
	`total_amount` real DEFAULT 0 NOT NULL,
	`notes` text,
	`raised_by` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE INDEX `purchase_order_status_idx` ON `purchase_orders` (`status`,`order_date`);--> statement-breakpoint
CREATE TABLE `raw_material_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_number` text NOT NULL,
	`goods_receipt_id` text NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity_received` real NOT NULL,
	`quantity_remaining` real NOT NULL,
	`warehouse` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raw_material_batches_batch_number_unique` ON `raw_material_batches` (`batch_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `raw_material_batches_goods_receipt_id_unique` ON `raw_material_batches` (`goods_receipt_id`);--> statement-breakpoint
CREATE INDEX `raw_material_batch_item_idx` ON `raw_material_batches` (`item_name`);--> statement-breakpoint
CREATE TABLE `sales_order_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`sales_order_id` text NOT NULL,
	`product_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity_ordered` real NOT NULL,
	`quantity_dispatched` real DEFAULT 0 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sales_order_line_order_idx` ON `sales_order_lines` (`sales_order_id`);--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`so_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`currency` text DEFAULT 'NGN' NOT NULL,
	`order_date` integer NOT NULL,
	`required_date` integer,
	`total_amount` real DEFAULT 0 NOT NULL,
	`notes` text,
	`raised_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_so_number_unique` ON `sales_orders` (`so_number`);--> statement-breakpoint
CREATE INDEX `sales_order_status_idx` ON `sales_orders` (`status`,`order_date`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`address` text,
	`supplied_items` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_code_unique` ON `suppliers` (`code`);--> statement-breakpoint
CREATE INDEX `supplier_status_idx` ON `suppliers` (`status`,`name`);