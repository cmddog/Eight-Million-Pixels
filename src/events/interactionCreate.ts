import {
    Events,
    type Interaction,
    type InteractionReplyOptions,
    MessageFlags,
} from 'discord.js';
import { isAutocompleteCommand } from '../utils.js';

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
    } else {
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
