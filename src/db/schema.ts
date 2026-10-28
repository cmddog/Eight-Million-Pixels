import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const triggers = sqliteTable('triggers', {
    name: text().primaryKey(),
    description: text().notNull(),
    subscribers: text().notNull(),
});

export const pseudonyms = sqliteTable('pseudonyms', {
    userId: text('user_id').primaryKey(),
    pseudonym: text().unique().notNull(),
});

export const loggingChannel = sqliteTable('logging_channel', {
    loggingChannelId: text('logging_channel_id').notNull(),
    id: integer().primaryKey().default(1),
});
