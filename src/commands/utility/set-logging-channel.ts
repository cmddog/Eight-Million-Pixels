import {
    ChannelType,
    type ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../db/client.js';
import { containerDisplay } from '../../utils.js';
import { keyValue } from '../../db/schema.js';

export const data = new SlashCommandBuilder()
    .setName('set-logging-channel')
    .setDescription('Set the channel the bot should send logs in')
    .addChannelOption((o) =>
        o
            .setName('channel')
            .setDescription('The channel to send logs in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
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
        .values({ key: 'loggingChannelId', value: channel.id })
        .onConflictDoUpdate({
            target: keyValue.key,
            set: { value: channel.id },
        });

    return interaction.editReply(
        containerDisplay({
            text: `Logging channel set to ${channel}`,
            color: 'primary',
        }),
    );
}
