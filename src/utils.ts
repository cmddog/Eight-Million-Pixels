import type { Command } from './types.js';
import { db } from './db/client.js';
import { loggingChannel } from './db/schema.js';
import {
    type ActionRowBuilder,
    type ButtonBuilder,
    type ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';

export function isCommand(value: unknown): value is Command {
    return (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        'execute' in value
    );
}

export function isAutocompleteCommand(
    cmd: Command,
): cmd is Command & Required<Pick<Command, 'autocomplete'>> {
    return typeof cmd.autocomplete === 'function';
}

export async function log(
    embed: EmbedBuilder,
    interaction: ChatInputCommandInteraction,
    actions?: ActionRowBuilder<ButtonBuilder>,
) {
    const [row] = await db
        .select({ channelId: loggingChannel.loggingChannelId })
        .from(loggingChannel);

    if (!row) return;

    const channel = await interaction.guild?.channels.fetch(row.channelId);
    if (!channel?.isTextBased()) return;

    await channel.send({
        embeds: [embed.setColor(0x7289da)],
        components: actions ? [actions] : [],
    });
}
