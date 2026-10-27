import {
    Events,
    type Interaction,
    type InteractionReplyOptions,
    MessageFlags,
} from 'discord.js';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(
            `No command matching ${interaction.commandName} was found.`,
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const errorResponse = {
            content: 'There was an error while executing this command.',
            flags: MessageFlags.Ephemeral,
        } as InteractionReplyOptions;
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorResponse);
        } else {
            await interaction.reply(errorResponse);
        }
    }
}
