import {
    type ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { containerDisplay, fireAndForget } from '../../utils.js';
import { db } from '../../db/client.js';
import { keyValue } from '../../db/schema.js';

export const data = new SlashCommandBuilder()
    .setName('set-status')
    .setDescription("Sets the bot's status message")
    .addStringOption((o) =>
        o
            .setName('content')
            .setDescription('The status message')
            .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const status = interaction.options.getString('content', true);

    interaction.client.user.setPresence({
        activities: [
            {
                name: status,
            },
        ],
        status: 'online',
    });

    fireAndForget(
        db
            .insert(keyValue)
            .values({
                key: 'status',
                value: status,
            })
            .onConflictDoUpdate({
                target: keyValue.key,
                set: { value: status },
            }),
    );

    return interaction.reply(
        containerDisplay({
            text: `Status set to "${status}"`,
            color: 'primary',
        }),
    );
}
