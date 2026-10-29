import {
    ChannelType,
    type ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../db/client.js';
import { loggingChannel } from '../../db/schema.js';

export const data = new SlashCommandBuilder()
    .setName('set-logging-channel')
    .setDescription('Set the channel the bot should send logs in')
    .addChannelOption((o) =>
        o
            .setName('channel')
            .setDescription('')
            .addChannelTypes(ChannelType.GuildText),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel', true, [
        ChannelType.GuildText,
    ]);

    if (
        !channel
            .permissionsFor(interaction.client.user)
            ?.has(PermissionFlagsBits.SendMessages)
    ) {
        return interaction.reply({
            content: "I don't have permission to send messages in that channel",
            flags: MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply();

    await db
        .insert(loggingChannel)
        .values({ loggingChannelId: channel.id })
        .onConflictDoUpdate({
            target: loggingChannel.id,
            set: { loggingChannelId: channel.id },
        });

    return interaction.editReply(`Logging channel set to ${channel}`);
}
