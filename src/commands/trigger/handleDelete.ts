import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    MessageFlags,
} from 'discord.js';
import { db } from '../../db/client.js';
import { count, like } from 'drizzle-orm';
import { triggers, triggerSubscribers } from '../../db/schema.js';
import { buildContainer, containerDisplay } from '../../utils.js';
import type { PartialMessageOptions } from '../../types.js';
import { sendUpdate, verifyAdmin } from './trigger.js';

export async function handleDelete(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    if (!verifyAdmin(interaction)) return;
    await interaction.deferReply();

    const name = interaction.options.getString('name', true);
    const trigger = await db.query.triggers.findFirst({
        where: like(triggers.name, name),
    });

    if (!trigger)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called ${name}`,
                color: 'error',
            }),
        );

    const [countRow] = await db
        .select({ value: count() })
        .from(triggerSubscribers)
        .where(like(triggerSubscribers.triggerName, name));
    const subscriberCount = countRow?.value ?? 0;
    const buildConfirmationReply: (
        confirmed: boolean,
    ) => PartialMessageOptions = (confirmed: boolean) => ({
        components: [
            buildContainer({
                text: `Are you sure you want to delete the trigger **${name}**? It currently has ${subscriberCount} ${subscriberCount === 1 ? 'subscriber' : 'subscribers'}.`,
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

    const collector = message.createMessageComponentCollector({
        time: 60_000,
        componentType: ComponentType.Button,
    });
    let handled = false;

    collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id)
            return i.reply(
                containerDisplay(
                    { text: 'Not your dialog', color: 'error' },
                    MessageFlags.Ephemeral,
                ),
            );

        handled = true;
        if (i.customId === 'confirm') {
            await i.update(buildConfirmationReply(true));
            const trigger = await db.query.triggers.findFirst({
                where: like(triggers.name, name),
            });

            if (!trigger) {
                collector.stop();
                return interaction.editReply(
                    containerDisplay({
                        text: `The trigger **${name}** no longer exists`,
                        color: 'error',
                    }),
                );
            }

            await db.delete(triggers).where(like(triggers.name, name));
            await i.followUp(
                containerDisplay({
                    text: `Successfully deleted trigger **${trigger.name}**`,
                    color: 'primary',
                }),
            );

            void sendUpdate(
                `### Removed\n**${trigger.name}**\n${trigger.description}`,
                interaction.guild!,
                'error',
            );
        } else {
            await i.update(
                containerDisplay({ text: 'Interaction cancelled by user' }),
            );
        }
        return collector.stop();
    });

    collector.on('end', () => {
        if (!handled) {
            void interaction.editReply(
                containerDisplay({ text: 'Interaction timed out' }),
            );
        }
    });
    return;
}
