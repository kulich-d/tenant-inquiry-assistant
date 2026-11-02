CREATE TABLE `payment_rules` (
	`signature` text NOT NULL,
	`amount` integer NOT NULL,
	`tenant_id` text NOT NULL,
	`confirmed_by` text NOT NULL,
	`confirmed_at` text NOT NULL,
	PRIMARY KEY(`signature`, `amount`)
);
