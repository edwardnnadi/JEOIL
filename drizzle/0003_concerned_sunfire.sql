CREATE TABLE `production_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_number` text NOT NULL,
	`machine` text NOT NULL,
	`source_warehouse` text NOT NULL,
	`output_warehouse` text NOT NULL,
	`staff` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`started_by` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`recorded_ended_at` integer,
	`end_time_confirmed` integer,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_runs_batch_number_unique` ON `production_runs` (`batch_number`);--> statement-breakpoint
CREATE INDEX `production_run_status_idx` ON `production_runs` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`movement_type` text NOT NULL,
	`item_name` text NOT NULL,
	`unit` text NOT NULL,
	`quantity` real NOT NULL,
	`warehouse` text,
	`lot_number` text,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`note` text,
	`recorded_by` text NOT NULL,
	`recorded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stock_movement_item_warehouse_idx` ON `stock_movements` (`item_name`,`warehouse`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `stock_movement_source_idx` ON `stock_movements` (`source_type`,`source_id`);