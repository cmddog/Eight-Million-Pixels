import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { containerDisplay } from '../../utils.js';
import { db } from '../../db/client.js';
import { and, notInArray } from 'drizzle-orm';
import { triggers, triggerSubscribers } from '../../db/schema.js';
import { nameEquals, verifyAdmin } from './trigger.js';

export async function handleMerge(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    if (!verifyAdmin(interaction)) return;

    const sourceName = interaction.options.getString('source-name', true);
    const targetName = interaction.options.getString('target-name', true);

    if (sourceName.toLowerCase() === targetName.toLowerCase())
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
        where: nameEquals(triggers.name, sourceName),
    });
    if (!source)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called **${sourceName}**`,
                color: 'error',
            }),
        );

    const target = await db.query.triggers.findFirst({
        where: nameEquals(triggers.name, targetName),
    });
    if (!target)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called **${targetName}**`,
                color: 'error',
            }),
        );

    const targetSubs = await db.query.triggerSubscribers.findMany({
        where: nameEquals(triggerSubscribers.triggerName, target.name),
    });
    const targetUserIds = targetSubs.map((s) => s.userId);

    await db
        .update(triggerSubscribers)
        .set({ triggerName: target.name })
        .where(
            and(
                nameEquals(triggerSubscribers.triggerName, source.name),
                targetUserIds.length > 0
                    ? notInArray(triggerSubscribers.userId, targetUserIds)
                    : undefined,
            ),
        );
    await db.delete(triggers).where(nameEquals(triggers.name, source.name));
    return interaction.editReply(
        containerDisplay({
            text: `Transferred unique subscribers to **${targetName}** and deleted **${sourceName}**`,
            color: 'primary',
        }),
    );
}
