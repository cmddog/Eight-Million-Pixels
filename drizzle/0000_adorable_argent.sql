CREATE TABLE `key-value` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `key-value` (`key`, `value`)
SELECT 'loggingChannelId', `logging_channel_id` FROM `logging_channel`;
--> statement-breakpoint
DROP TABLE `logging_channel`;
