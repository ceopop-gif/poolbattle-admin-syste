CREATE TABLE `competition_result_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`member_id` text NOT NULL,
	`player_id_snapshot` text NOT NULL,
	`display_name_snapshot` text NOT NULL,
	`opponent_player_id` text,
	`staff_code` text NOT NULL,
	`discipline` text NOT NULL,
	`outcome` text NOT NULL,
	`player_score` integer NOT NULL,
	`opponent_score` integer NOT NULL,
	`status` text NOT NULL,
	`business_date` text NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_result_submissions_idempotency` ON `competition_result_submissions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_result_submissions_member_date` ON `competition_result_submissions` (`member_id`,`business_date`);--> statement-breakpoint
CREATE INDEX `idx_result_submissions_staff_date` ON `competition_result_submissions` (`staff_code`,`business_date`);--> statement-breakpoint
PRAGMA optimize;
