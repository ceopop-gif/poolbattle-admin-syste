CREATE TABLE `battle_ticket_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`member_id` text NOT NULL,
	`games` integer NOT NULL,
	`price_per_game` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`payment_status` text NOT NULL,
	`purchased_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_battle_ticket_orders_idempotency` ON `battle_ticket_orders` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_battle_ticket_orders_member` ON `battle_ticket_orders` (`member_id`,`purchased_at`);--> statement-breakpoint
CREATE TABLE `battle_game_credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`order_id` text,
	`delta_games` integer NOT NULL,
	`entry_type` text NOT NULL,
	`source_ref` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `battle_ticket_orders`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_battle_game_credit_source` ON `battle_game_credit_ledger` (`source_ref`);--> statement-breakpoint
CREATE INDEX `idx_battle_game_credit_member` ON `battle_game_credit_ledger` (`member_id`,`created_at`);--> statement-breakpoint
INSERT OR IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `version`, `updated_at`, `updated_by`)
VALUES ('battle_game_price', '100', 1, '2026-09-02T00:00:00.000Z', 'SYSTEM');
