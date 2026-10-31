import {
    integer,
    primaryKey,
    sqliteTable,
    text,
} from 'drizzle-orm/sqlite-core';

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

export const loggingChannel = sqliteTable('logging_channel', {
    loggingChannelId: text('logging_channel_id').notNull(),
    id: integer().primaryKey().default(1),
});
