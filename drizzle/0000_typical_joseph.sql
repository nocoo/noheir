CREATE TABLE `capital_units` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`unit_code` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'CNY',
	`status` text DEFAULT '已成立',
	`strategy` text,
	`tactics` text,
	`product_id` text,
	`start_date` text,
	`end_date` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `financial_products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `financial_products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`channel` text,
	`category` text,
	`currency` text DEFAULT 'CNY',
	`lock_period_days` integer DEFAULT 0,
	`annual_return_rate` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`site_name` text DEFAULT '',
	`settings` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_owner_id_unique` ON `settings` (`owner_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`primary_category` text NOT NULL,
	`secondary_category` text,
	`tertiary_category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`type` text NOT NULL,
	`account` text NOT NULL,
	`currency` text DEFAULT '人民币' NOT NULL,
	`tags` text DEFAULT '[]',
	`note` text,
	`raw_index` integer,
	`has_secondary_mapping` integer DEFAULT true,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`primary_category` text,
	`secondary_category` text DEFAULT '转账',
	`transaction_type` text,
	`inflow_amount_cents` integer DEFAULT 0,
	`outflow_amount_cents` integer DEFAULT 0,
	`currency` text DEFAULT '人民币' NOT NULL,
	`account` text NOT NULL,
	`tags` text DEFAULT '[]',
	`note` text,
	`raw_index` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`provider_account_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_provider_account_id_unique` ON `users` (`provider_account_id`);