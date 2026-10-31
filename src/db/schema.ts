import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const triggers = sqliteTable('triggers', {
    name: text().primaryKey(),
    description: text().notNull(),
});

export const triggerSubscribers = sqliteTable(
    'trigger_subscribers',
    {
        triggerName: text('trigger_name')
            .notNull()
            .references(() => triggers.name, {
                onDelete: 'cascade',
                onUpdate: 'cascade',
            }),
        userId: text('user_id').notNull(),
    },
    (t) => [primaryKey({ columns: [t.triggerName, t.userId] })],
);

export const pseudonyms = sqliteTable('pseudonyms', {
    userId: text('user_id').primaryKey(),
    pseudonym: text().unique().notNull(),
});

export const keyValue = sqliteTable('key-value', {
    key: text().primaryKey(),
    value: text().notNull(),
});
