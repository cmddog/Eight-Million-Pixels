import {
    type ChatInputCommandInteraction,
    MessageFlags,
    SeparatorBuilder,
} from 'discord.js';
import { db } from '../../db/client.js';
import { and, eq, like } from 'drizzle-orm';
import { triggers, triggerSubscribers } from '../../db/schema.js';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    log,
} from '../../utils.js';
import { sendUpdate } from './trigger.js';

export async function handleUnsubscribe(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.options.getString('name', true);

    const trigger = await db.query.triggers.findFirst({
        where: like(triggers.name, name),
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
                like(triggerSubscribers.triggerName, name),
                eq(triggerSubscribers.userId, interaction.user.id),
            ),
        );

    if (deleted.changes === 0)
        return interaction.editReply(
            containerDisplay({
                text: `You already weren't subscribed to **${trigger.name}**`,
            }),
        );

    const remaining = await db.query.triggerSubscribers.findFirst({
        where: like(triggerSubscribers.triggerName, name),
    });

    if (!remaining) {
        await db.delete(triggers).where(like(triggers.name, name));

        void log(interaction.guild!, [
            buildContainer({ text: '## Trigger Deleted' })
                .addTextDisplayComponents(
                    buildTextDisplay(
                        'This trigger lost its last subscriber and was deleted:',
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(
                    buildTextDisplay(`**${trigger.name}**`),
                    buildTextDisplay(`${trigger.description}`),
                ),
        ]);

        void sendUpdate(
            `### Removed\n**${trigger.name}\n${trigger.description}`,
            interaction.guild!,
            'error',
        );

        return interaction.editReply(
            containerDisplay({
                text: `Successfully unsubscribed from **${trigger.name}**. You were the last subscriber and the trigger has been deleted`,
                color: 'primary',
            }),
        );
    } else {
        return interaction.editReply(
            containerDisplay({
                text: `Successfully unsubscribed from **${trigger.name}**`,
                color: 'primary',
            }),
        );
    }
}
