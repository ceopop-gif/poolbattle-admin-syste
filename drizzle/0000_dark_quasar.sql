CREATE TABLE `day_passes` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`member_id` text NOT NULL,
	`business_date` text NOT NULL,
	`purchased_at` text NOT NULL,
	`ticket_number` text NOT NULL,
	`status` text NOT NULL,
	`membership_created` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `ticket_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_day_passes_ticket_number` ON `day_passes` (`ticket_number`);--> statement-breakpoint
CREATE INDEX `idx_day_passes_member_date` ON `day_passes` (`member_id`,`business_date`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`display_name` text NOT NULL,
	`player_id` text NOT NULL,
	`photo_key` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`first_login` integer DEFAULT true NOT NULL,
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_phone` ON `members` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_player_id` ON `members` (`player_id`);--> statement-breakpoint
CREATE TABLE `ticket_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`business_date` text NOT NULL,
	`purchased_at` text NOT NULL,
	`quantity` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`payment_status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ticket_orders_idempotency` ON `ticket_orders` (`idempotency_key`);--> statement-breakpoint
PRAGMA optimize;
