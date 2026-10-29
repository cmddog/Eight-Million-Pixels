import { Events, type Interaction, MessageFlags } from 'discord.js';
import { containerDisplay, isAutocompleteCommand } from '../utils.js';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
        return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(
            `No command matching ${interaction.commandName} was found.`,
        );
        return;
    }

    if (interaction.isChatInputCommand()) {
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            const errorResponse = containerDisplay(
                {
                    text: 'There was an error while executing this command.',
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            );
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorResponse);
            } else {
                await interaction.reply(errorResponse);
            }
        }
    } else if (interaction.isAutocomplete()) {
        try {
            if (isAutocompleteCommand(command)) {
                await command.autocomplete(interaction);
            } else {
                console.error(
                    `Missing autocomplete handler for ${interaction.commandName}`,
                );
                interaction.respond([]);
            }
        } catch (error) {
            console.error(error);
        }
    }
}
