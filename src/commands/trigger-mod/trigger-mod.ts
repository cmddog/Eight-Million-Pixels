import {
    type AutocompleteInteraction,
    ChannelType,
    type ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    PermissionsBitField,
    SlashCommandBuilder,
} from 'discord.js';
import { handleEdit } from './handleEdit.js';
import { handleDelete } from './handleDelete.js';
import { handleMerge } from './handleMerge.js';
import { handleGetUser } from './handleGetUser.js';
import { handleSetUpdateChannel } from './handleSetUpdateChannel.js';
import { triggerAutocomplete } from '../triggerAutocomplete/handleSharedAutocomplete.js';
import { containerDisplay, fireAndForget } from '../../utils.js';

export const data = new SlashCommandBuilder()
    .setName('trigger-mod')
    .setDescription('Mod utilities for triggers')
    .addSubcommand((sub) =>
        sub
            .setName('edit')
            .setDescription('Edit the name or description of a trigger')
            .addStringOption((o) =>
                o
                    .setName('name')
                    .setDescription('The current name of the trigger')
                    .setAutocomplete(true)
                    .setRequired(true),
            )
            .addStringOption((o) =>
                o
                    .setName('property')
                    .setDescription(
                        'Whether you want to edit the name or the description.',
                    )
                    .setChoices(
                        {
                            name: 'Name',
                            value: 'name',
                        },
                        {
                            name: 'Description',
                            value: 'description',
                        },
                    )
                    .setRequired(true),
            )
            .addStringOption((o) =>
                o
                    .setName('new-value')
                    .setDescription('A new value for the name/description')
                    .setMinLength(3)
                    .setMaxLength(512)
                    .setRequired(true),
            )
            .addBooleanOption((o) =>
                o
                    .setName('with-announcement')
                    .setDescription(
                        'Whether this edit should be announced in the trigger update channel',
                    ),
            ),
    )
    .addSubcommand((sub) =>
        sub
            .setName('delete')
            .setDescription('Delete a specified trigger entirely')
            .addStringOption((o) =>
                o
                    .setName('name')
                    .setDescription('The trigger to delete')
                    .setAutocomplete(true)
                    .setRequired(true),
            ),
    )
    .addSubcommand((sub) =>
        sub
            .setName('merge')
            .setDescription('Used to merge duplicate triggers')
            .addStringOption((o) =>
                o
                    .setName('source-name')
                    .setDescription(
                        'The name of the trigger to transfer the IDs FROM that will subsequently be deleted',
                    )
                    .setAutocomplete(true)
                    .setRequired(true),
            )
            .addStringOption((o) =>
                o
                    .setName('target-name')
                    .setDescription(
                        'The name of the trigger to transfer the IDs TO that will remain',
                    )
                    .setAutocomplete(true)
                    .setRequired(true),
            ),
    )
    .addSubcommand((sub) =>
        sub
            .setName('get-user')
            .setDescription(
                'Fetches a user based on their pseudonym. Warning: Response is not ephemeral',
            )
            .addStringOption((o) =>
                o
                    .setName('pseudonym')
                    .setDescription(
                        'The pseudonym of the user you want to retrieve',
                    )
                    .setRequired(true),
            ),
    )
    .addSubcommand((sub) =>
        sub
            .setName('set-update-channel')
            .setDescription(
                'Sets the channel that EMP should send updates about triggers in',
            )
            .addChannelOption((o) =>
                o
                    .setName('channel')
                    .setDescription('The channel to send updates in')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true),
            ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const handlers: Record<string, (i: ChatInputCommandInteraction) => unknown> = {
    edit: handleEdit,
    delete: handleDelete,
    merge: handleMerge,
    'get-user': handleGetUser,
    'set-update-channel': handleSetUpdateChannel,
};

export async function execute(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    return handlers[interaction.options.getSubcommand()]?.(interaction);
}

export async function autocomplete(
    interaction: AutocompleteInteraction,
): Promise<unknown> {
    return triggerAutocomplete(interaction);
}

export function verifyAdminOrOther(
    interaction: ChatInputCommandInteraction,
    permission: bigint = PermissionFlagsBits.Administrator,
): boolean {
    const hasPermission = interaction.memberPermissions?.has(permission);
    if (!hasPermission) {
        const permissionName =
            new PermissionsBitField(permission).toArray()[0] ??
            'Unknown Permission';
        fireAndForget(
            interaction.reply(
                containerDisplay(
                    {
                        text: `You need ${permissionName} to use this command`,
                        color: 'error',
                    },
                    MessageFlags.Ephemeral,
                ),
            ),
        );
    }
    return !!hasPermission;
}
