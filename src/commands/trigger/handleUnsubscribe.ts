import {
    type ChatInputCommandInteraction,
    MessageFlags,
    SeparatorBuilder,
} from 'discord.js';
import { db } from '../../db/client.js';
import { and, eq } from 'drizzle-orm';
import { triggers, triggerSubscribers } from '../../db/schema.js';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    log,
} from '../../utils.js';

export async function handleUnsubscribe(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.options.getString('name', true);

    const trigger = await db.query.triggers.findFirst({
        where: eq(triggers.name, name),
    });
    if (!trigger) {
        return interaction.editReply(
            containerDisplay({
                text: `The trigger ${name} doesn't exist`,
                color: 'error',
            }),
        );
    }

    const deleted = await db
        .delete(triggerSubscribers)
        .where(
            and(
                eq(triggerSubscribers.triggerName, name),
                eq(triggerSubscribers.userId, interaction.user.id),
            ),
        );

    if (deleted.changes === 0)
        return interaction.editReply(
            containerDisplay({
                text: `You already weren't subscribed to **${name}**`,
            }),
        );

    const remaining = await db.query.triggerSubscribers.findFirst({
        where: eq(triggerSubscribers.triggerName, name),
    });

    if (!remaining) {
        await db.delete(triggers).where(eq(triggers.name, name));

        void log(interaction.guild!, [
            buildContainer({ text: '## Trigger Deleted' })
                .addTextDisplayComponents(
                    buildTextDisplay(
                        'This trigger lost its last subscriber and was deleted:',
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(
                    buildTextDisplay(`**${name}**`),
                    buildTextDisplay(`${trigger.description}`),
                ),
        ]);

        return interaction.editReply(
            containerDisplay({
                text: `Successfully unsubscribed from **${name}**. You were the last subscriber and the trigger has been deleted`,
                color: 'primary',
            }),
        );
    } else {
        return interaction.editReply(
            containerDisplay({
                text: `Successfully unsubscribed from **${name}**`,
                color: 'primary',
            }),
        );
    }
}
