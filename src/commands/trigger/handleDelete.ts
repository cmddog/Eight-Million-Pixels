import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    MessageFlags,
} from 'discord.js';
import { db } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import { triggers } from '../../db/schema.js';
import { buildContainer, containerDisplay } from '../../utils.js';
import type { PartialMessageOptions } from '../../types.js';
import { verifyAdmin } from './trigger.js';

export async function handleDelete(interaction: ChatInputCommandInteraction) {
    if (!verifyAdmin(interaction)) return;
    await interaction.deferReply();

    const name = interaction.options.getString('name', true);
    const trigger = await db.query.triggers.findFirst({
        where: eq(triggers.name, name),
    });

    if (!trigger)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called ${name}`,
                color: 'error',
            }),
        );

    const subscriberCount = trigger.subscribers.split(',').length;
    const buildConfirmationReply: (
        confirmed: boolean,
    ) => PartialMessageOptions = (confirmed: boolean) => ({
        components: [
            buildContainer({
                text: `Are you sure you want to delete the trigger **${name}**? It currently has ${subscriberCount} ${subscriberCount === 1 ? 'subscriber' : 'subscriber'}.`,
                color: 'error',
            }).addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().setComponents(
                    new ButtonBuilder()
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId('cancel')
                        .setDisabled(confirmed),
                    new ButtonBuilder()
                        .setLabel(confirmed ? 'Confirmed' : 'Confirm')
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId('confirm')
                        .setDisabled(confirmed),
                ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
    });
    const message = await interaction.editReply(buildConfirmationReply(false));

    try {
        const btn = await message.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            componentType: ComponentType.Button,
        });

        if (btn.customId === 'confirm') {
            await btn.update(buildConfirmationReply(true));
            await db.delete(triggers).where(eq(triggers.name, name));
            return btn.followUp(
                containerDisplay({
                    text: `Successfully deleted trigger **${name}**`,
                    color: 'primary',
                }),
            );
        } else {
            return btn.update(
                containerDisplay({ text: 'Interaction cancelled by user' }),
            );
        }
    } catch {
        return interaction.editReply(
            containerDisplay({ text: 'Interaction timed out' }),
        );
    }
}
