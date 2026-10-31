CREATE TABLE IF NOT EXISTS `key-value` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pseudonyms` (
	`user_id` text PRIMARY KEY NOT NULL,
	`pseudonym` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pseudonyms_pseudonym_unique` ON `pseudonyms` (`pseudonym`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trigger_subscribers` (
	`trigger_name` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`trigger_name`, `user_id`),
	FOREIGN KEY (`trigger_name`) REFERENCES `triggers`(`name`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `triggers` (
	`name` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL
);
