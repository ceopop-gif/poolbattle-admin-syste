CREATE TABLE `admin_competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`discipline` text NOT NULL,
	`starts_at` text NOT NULL,
	`capacity` integer NOT NULL,
	`entry_fee` integer NOT NULL,
	`status` text NOT NULL,
	`ruleset_version` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_competitions_start` ON `admin_competitions` (`starts_at`,`status`);--> statement-breakpoint
CREATE TABLE `admin_news` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_news_status_priority` ON `admin_news` (`status`,`priority`);--> statement-breakpoint
CREATE TABLE `admin_queue_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`display_name` text NOT NULL,
	`queue_type` text NOT NULL,
	`discipline` text NOT NULL,
	`position` integer NOT NULL,
	`status` text NOT NULL,
	`table_id` text,
	`joined_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `venue_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_admin_queue_status_position` ON `admin_queue_tickets` (`status`,`position`);--> statement-breakpoint
CREATE TABLE `admin_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_code` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_admin_staff_code` ON `admin_staff` (`staff_code`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_code` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_created` ON `audit_events` (`created_at`,`actor_code`);--> statement-breakpoint
CREATE TABLE `competition_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text NOT NULL,
	`paid_amount` integer NOT NULL,
	`registered_at` text NOT NULL,
	`checked_in_at` text,
	FOREIGN KEY (`competition_id`) REFERENCES `admin_competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_competition_registration_member` ON `competition_registrations` (`competition_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_competition_registration_status` ON `competition_registrations` (`competition_id`,`status`);--> statement-breakpoint
CREATE TABLE `point_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`submission_id` text,
	`account_type` text NOT NULL,
	`point_type` text NOT NULL,
	`points` integer NOT NULL,
	`business_date` text NOT NULL,
	`created_at` text NOT NULL,
	`reversal_of` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `competition_result_submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_point_ledger_source_account` ON `point_ledger_entries` (`submission_id`,`account_type`,`point_type`);--> statement-breakpoint
CREATE INDEX `idx_point_ledger_member_date` ON `point_ledger_entries` (`member_id`,`business_date`);--> statement-breakpoint
CREATE TABLE `result_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`actor_code` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `competition_result_submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_result_reviews_submission` ON `result_reviews` (`submission_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reward_pool_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`entry_type` text NOT NULL,
	`amount` integer NOT NULL,
	`source_ref` text NOT NULL,
	`reason` text NOT NULL,
	`actor_code` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reward_pool_source` ON `reward_pool_entries` (`source_ref`);--> statement-breakpoint
CREATE INDEX `idx_reward_pool_period` ON `reward_pool_entries` (`period`,`created_at`);--> statement-breakpoint
CREATE TABLE `risk_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`flag_type` text NOT NULL,
	`severity` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_risk_flags_status_severity` ON `risk_flags` (`status`,`severity`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`setting_key` text PRIMARY KEY NOT NULL,
	`setting_value` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `venue_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`table_type` text NOT NULL,
	`status` text NOT NULL,
	`current_player` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_venue_tables_label` ON `venue_tables` (`label`);--> statement-breakpoint
ALTER TABLE `members` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `venue_tables` (`id`, `label`, `table_type`, `status`, `current_player`, `updated_at`) VALUES
  ('table-01', 'โต๊ะ 1', 'standard', 'available', NULL, '2026-09-01T00:00:00.000Z'),
  ('table-02', 'โต๊ะ 2', 'standard', 'available', NULL, '2026-09-01T00:00:00.000Z'),
  ('table-03', 'โต๊ะ 3', 'standard', 'available', NULL, '2026-09-01T00:00:00.000Z'),
  ('table-04', 'โต๊ะ 4', 'standard', 'available', NULL, '2026-09-01T00:00:00.000Z'),
  ('table-05', 'โต๊ะ 5', 'competition', 'available', NULL, '2026-09-01T00:00:00.000Z'),
  ('table-06', 'โต๊ะ 6', 'competition', 'available', NULL, '2026-09-01T00:00:00.000Z'),
  ('table-07', 'โต๊ะ 7', 'vip', 'available', NULL, '2026-09-01T00:00:00.000Z'),
  ('table-08', 'โต๊ะ 8', 'vip', 'available', NULL, '2026-09-01T00:00:00.000Z');--> statement-breakpoint
INSERT OR IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `version`, `updated_at`, `updated_by`) VALUES
  ('venue_display_name', 'POOL BATTLE ARENA', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('day_pass_price', '150', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('day_pass_cutoff', '17:00', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('competition_entry_fee', '1000', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('event_prize_share', '60', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('venue_event_share', '40', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('fnb_cost_share', '50', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('reward_pool_share', '10', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('venue_fnb_share', '40', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('eligibility_days', '5', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('eligibility_groups', '10', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('notification_queue_minutes', '10', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM'),
  ('ruleset_version', 'PB-RULES-1', 1, '2026-09-01T00:00:00.000Z', 'SYSTEM');--> statement-breakpoint
PRAGMA optimize;
