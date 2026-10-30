import {
    type ChatInputCommandInteraction,
    MessageFlags,
    SeparatorBuilder,
} from 'discord.js';
import { db } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import { triggers } from '../../db/schema.js';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    log,
} from '../../utils.js';

export async function handleUnsubscribe(
    interaction: ChatInputCommandInteraction,
) {
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

    const oldSubs = trigger.subscribers.split(',');
    const newSubs = oldSubs.filter((id) => id !== interaction.user.id);

    if (oldSubs === newSubs)
        return interaction.editReply(
            containerDisplay({
                text: `You already weren't subscribed to **${name}**`,
            }),
        );

    if (newSubs.length === 0) {
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
        await db
            .update(triggers)
            .set({ subscribers: newSubs.join(',') })
            .where(eq(triggers.name, name));
        return interaction.editReply(
            containerDisplay({
                text: `Successfully unsubscribed from **${name}**`,
                color: 'primary',
            }),
        );
    }
}
