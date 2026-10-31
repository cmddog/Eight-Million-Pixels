import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { containerDisplay } from '../../utils.js';
import { db } from '../../db/client.js';
import { and, eq, notInArray } from 'drizzle-orm';
import { triggers, triggerSubscribers } from '../../db/schema.js';
import { verifyAdmin } from './trigger.js';

export async function handleMerge(interaction: ChatInputCommandInteraction) {
    if (!verifyAdmin(interaction)) return;

    const sourceName = interaction.options.getString('source-name', true);
    const targetName = interaction.options.getString('target-name', true);

    if (sourceName === targetName)
        return interaction.reply(
            containerDisplay(
                {
                    text: 'Source and target cannot be the same',
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            ),
        );
    await interaction.deferReply();

    const source = await db.query.triggers.findFirst({
        where: eq(triggers.name, sourceName),
    });
    if (!source)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called **${sourceName}**`,
                color: 'error',
            }),
        );

    const target = await db.query.triggers.findFirst({
        where: eq(triggers.name, targetName),
    });
    if (!target)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called **${targetName}**`,
                color: 'error',
            }),
        );

    const targetSubs = await db.query.triggerSubscribers.findMany({
        where: eq(triggerSubscribers.triggerName, targetName),
    });
    const targetUserIds = targetSubs.map((s) => s.userId);

    await db
        .update(triggerSubscribers)
        .set({ triggerName: targetName })
        .where(
            and(
                eq(triggerSubscribers.triggerName, sourceName),
                targetUserIds.length > 0
                    ? notInArray(triggerSubscribers.userId, targetUserIds)
                    : undefined,
            ),
        );
    await db.delete(triggers).where(eq(triggers.name, sourceName));
    return interaction.editReply(
        containerDisplay({
            text: `Transferred unique subscribers to **${targetName}** and deleted **${sourceName}**`,
            color: 'primary',
        }),
    );
}
