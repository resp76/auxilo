CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_account_id` text NOT NULL,
	`display_label` text,
	`status` text DEFAULT 'active' NOT NULL,
	`cursor` text,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_integrations_account` ON `integrations` (`owner_id`,`provider`,`external_account_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`space_id` text,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`due_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_projects_owner_status` ON `projects` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'violet' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_spaces_owner_position` ON `spaces` (`owner_id`,`position`);--> statement-breakpoint
CREATE TABLE `sync_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`direction` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sync_events_owner_time` ON `sync_events` (`owner_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`project_id` text,
	`space_id` text,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`due_at` integer,
	`reminder_at` integer,
	`source` text DEFAULT 'relay' NOT NULL,
	`source_id` text,
	`source_url` text,
	`source_revision` text,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_status_due` ON `tasks` (`owner_id`,`status`,`due_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_source_identity` ON `tasks` (`owner_id`,`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);
--> statement-breakpoint
PRAGMA optimize;
