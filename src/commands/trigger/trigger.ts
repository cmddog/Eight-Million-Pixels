import {
    type AutocompleteInteraction,
    ChannelType,
    type ChatInputCommandInteraction,
    type Guild,
    MessageFlags,
    PermissionFlagsBits,
    SeparatorBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../db/client.js';
import { keyValue, triggers, triggerSubscribers } from '../../db/schema.js';
import { and, eq, like } from 'drizzle-orm';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    getOrCreatePseudonym,
    log,
} from '../../utils.js';
import { handleSubscribe } from './handleSubscribe.js';
import { handleUnsubscribe } from './handleUnsubscribe.js';
import { handleEdit } from './handleEdit.js';
import { handleDelete } from './handleDelete.js';
import { handleMerge } from './handleMerge.js';
import { handleGetUser } from './handleGetUser.js';
import { handleList } from './handleList.js';
import { handleHelp } from './handleHelp.js';
import { handleSetUpdateChannel } from './handleSetUpdateChannel.js';
import type { AccentColor } from '../../types.js';

export const data = new SlashCommandBuilder()
    .setName('trigger')
    .setDescription('Manage triggers')
    .addSubcommand((sub) =>
        sub
            .setName('subscribe')
            .setDescription(
                'Subscribe to a trigger or add a new one. Name must be limited to letters and spaces',
            )
            .addStringOption((o) =>
                o
                    .setName('name')
                    .setDescription('The name of the trigger. (e.g. Spiders)')
                    .setMinLength(3)
                    .setMaxLength(20)
                    .setAutocomplete(true)
                    .setRequired(true),
            )
            .addStringOption((o) =>
                o
                    .setName('description')
                    .setDescription(
                        'A more detailed description of the trigger. (e.g. Any imagery depicting spider-adjacent things)',
                    )
                    .setMinLength(10)
                    .setMaxLength(512),
            ),
    )
    .addSubcommand((sub) =>
        sub
            .setName('unsubscribe')
            .setDescription(
                'Unsubscribe yourself from a trigger. If you were the only subscriber, it is deleted',
            )
            .addStringOption((o) =>
                o
                    .setName('name')
                    .setDescription(
                        'The name of the trigger to unsubscribe from',
                    )
                    .setAutocomplete(true)
                    .setRequired(true),
            ),
    )
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
            .setName('list')
            .setDescription('List all triggers')
            .addBooleanOption((o) =>
                o
                    .setName('mine')
                    .setDescription('Only show triggers you’re subscribed to'),
            ),
    )
    .addSubcommand((sub) =>
        sub
            .setName('help')
            .setDescription(
                'Displays an explanation of how the trigger system works.',
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
    );

const handlers: Record<string, (i: ChatInputCommandInteraction) => unknown> = {
    subscribe: handleSubscribe,
    unsubscribe: handleUnsubscribe,
    edit: handleEdit,
    delete: handleDelete,
    merge: handleMerge,
    'get-user': handleGetUser,
    list: handleList,
    help: handleHelp,
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
    const focused = interaction.options.getFocused();
    const results = await db
        .select({ name: triggers.name })
        .from(triggers)
        .where(like(triggers.name, `%${focused}%`))
        .limit(25);
    return interaction.respond(
        results.map((r) => ({ name: r.name, value: r.name })),
    );
}

export async function insertTrigger(
    name: string,
    description: string,
    interaction: ChatInputCommandInteraction,
): Promise<void> {
    await db.insert(triggers).values({ name, description });
    await db
        .insert(triggerSubscribers)
        .values({ triggerName: name, userId: interaction.user.id });

    const pseudonym = await getOrCreatePseudonym(interaction.user.id);
    void log(interaction.guild!, [
        buildContainer({ color: 'primary' })
            .addTextDisplayComponents(
                buildTextDisplay('## Added New Trigger'),
                buildTextDisplay(`**${name}**`),
                buildTextDisplay(description),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                buildTextDisplay(`Added by ${pseudonym}`),
            ),
    ]);

    void sendUpdate(
        `### Added\n**${name}**\n${description}`,
        interaction.guild!,
        'primary',
    );
}

export async function subscribeToTrigger(
    name: string,
    userId: string,
): Promise<void> {
    await db
        .insert(triggerSubscribers)
        .values({ triggerName: name, userId })
        .onConflictDoNothing();
}

export async function isSubscribed(
    name: string,
    userId: string,
): Promise<boolean> {
    const row = await db.query.triggerSubscribers.findFirst({
        where: and(
            like(triggerSubscribers.triggerName, name),
            eq(triggerSubscribers.userId, userId),
        ),
    });
    return row !== undefined;
}

export function isValidName(str: string): boolean {
    return /^[A-Za-z ]+$/.test(str);
}

export function verifyAdmin(interaction: ChatInputCommandInteraction): boolean {
    const hasAdmin = interaction.memberPermissions?.has(
        PermissionFlagsBits.Administrator,
    );
    if (!hasAdmin) {
        void interaction.reply(
            containerDisplay(
                {
                    text: 'You need to be an Administrator to use this command',
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            ),
        );
    }
    return !!hasAdmin;
}

export async function sendUpdate(
    text: string,
    guild: Guild,
    color?: AccentColor,
): Promise<void> {
    const kv = await db.query.keyValue.findFirst({
        where: eq(keyValue.key, 'triggerUpdateChannelId'),
    });

    console.log('send update, ', kv);

    if (!kv) return;

    const channel = await guild.channels.fetch(kv.value);
    if (!channel?.isTextBased()) return;

    await channel.send(
        containerDisplay({ text: text, ...(color && { color }) }),
    );
}
