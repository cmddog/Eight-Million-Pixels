import {
    ChannelType,
    type ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import { containerDisplay } from '../../utils.js';
import { db } from '../../db/client.js';
import { keyValue } from '../../db/schema.js';
import { verifyAdmin } from './trigger.js';

export async function handleSetCreateAnnouncementChannel(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    if (!verifyAdmin(interaction)) return;

    const channel = interaction.options.getChannel('channel', true, [
        ChannelType.GuildText,
    ]);

    if (
        !channel
            .permissionsFor(interaction.client.user)
            ?.has(PermissionFlagsBits.SendMessages)
    ) {
        return interaction.reply(
            containerDisplay(
                {
                    text: `I don't have permission to send messages in ${channel}`,
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            ),
        );
    }

    await interaction.deferReply();

    await db
        .insert(keyValue)
        .values({
            key: 'triggerCreateAnnouncementChannelId',
            value: channel.id,
        })
        .onConflictDoUpdate({
            target: keyValue.key,
            set: { value: channel.id },
        });

    return interaction.editReply(
        containerDisplay({
            text: `Trigger creation announcement channel set to ${channel}`,
            color: 'primary',
        }),
    );
}
