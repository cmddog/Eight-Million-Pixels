import {
    type ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';

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
    interaction.client.user.setPresence({
        activities: [
            {
                name: interaction.options.getString('content', true),
            },
        ],
        status: 'online',
    });

    return interaction.reply({
        content: 'Status set.',
        flags: MessageFlags.Ephemeral,
    });
}
