CREATE TABLE `contribution_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`product_id` text,
	`product_name` text,
	`operation_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`balance_after_cents` integer,
	`operation_date` text NOT NULL,
	`source` text DEFAULT 'manual',
	`note` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `capital_units`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `financial_products`(`id`) ON UPDATE no action ON DELETE restrict
);
