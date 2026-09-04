CREATE TABLE `qc_parameter_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`context` text NOT NULL,
	`stage` text,
	`parameter_key` text NOT NULL,
	`display_name` text NOT NULL,
	`unit` text,
	`data_type` text NOT NULL,
	`comparator` text NOT NULL,
	`threshold_value` real,
	`allowed_values` text DEFAULT '[]' NOT NULL,
	`is_critical` integer DEFAULT true NOT NULL,
	`regulatory_ref` text,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qc_definition_lookup_idx` ON `qc_parameter_definitions` (`context`,`stage`,`parameter_key`,`effective_to`);--> statement-breakpoint
CREATE TABLE `qc_test_result_parameters` (
	`id` text PRIMARY KEY NOT NULL,
	`qc_test_result_id` text NOT NULL,
	`parameter_key` text NOT NULL,
	`display_name` text NOT NULL,
	`submitted_value` text NOT NULL,
	`unit` text,
	`comparator` text NOT NULL,
	`threshold_snapshot` text NOT NULL,
	`is_critical` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`qc_test_result_id`) REFERENCES `qc_test_results`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `qc_result_parameter_result_idx` ON `qc_test_result_parameters` (`qc_test_result_id`);--> statement-breakpoint
CREATE TABLE `qc_test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`context` text NOT NULL,
	`stage` text NOT NULL,
	`batch_ref` text NOT NULL,
	`tested_by` text NOT NULL,
	`tested_at` integer NOT NULL,
	`overall_result` text NOT NULL,
	`overridden_by` text,
	`override_reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `qc_result_batch_idx` ON `qc_test_results` (`batch_ref`);--> statement-breakpoint
CREATE INDEX `qc_result_history_idx` ON `qc_test_results` (`context`,`stage`,`tested_at`);