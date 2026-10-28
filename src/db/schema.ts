import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const triggers = sqliteTable('triggers', {
    name: text('name').primaryKey(),
    description: text('description').notNull(),
    subscribers: text('subscribers').notNull(),
});
