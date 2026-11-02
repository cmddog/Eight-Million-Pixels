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
import { and, eq, sql, type SQL } from 'drizzle-orm';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    fireAndForget,
    getOrCreatePseudonym,
    log,
} from '../../utils.js';
import { handleSubscribe } from './handleSubscribe.js';
import { handleUnsubscribe } from './handleUnsubscribe.js';
import { handleList } from './handleList.js';
import { handleHelp } from './handleHelp.js';
import type { AccentColor } from '../../types.js';
import { triggerAutocomplete } from '../triggerAutocomplete/handleSharedAutocomplete.js';

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
    );

const handlers: Record<string, (i: ChatInputCommandInteraction) => unknown> = {
    subscribe: handleSubscribe,
    unsubscribe: handleUnsubscribe,
    list: handleList,
    help: handleHelp,
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
    fireAndForget(
        log(interaction.guild!, [
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
        ]),
    );

    fireAndForget(
        sendUpdate(
            `### Added\n**${name}**\n${description}`,
            interaction.guild!,
            'primary',
        ),
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
            nameEquals(triggerSubscribers.triggerName, name),
            eq(triggerSubscribers.userId, userId),
        ),
    });
    return row !== undefined;
}

export function isValidName(str: string): boolean {
    return /^[A-Za-z ]+$/.test(str);
}

export function nameEquals(
    column: typeof triggers.name | typeof triggerSubscribers.triggerName,
    value: string,
): SQL {
    return sql`lower(${column}) = lower(${value})`;
}

export async function sendUpdate(
    text: string,
    guild: Guild,
    color?: AccentColor,
): Promise<void> {
    const kv = await db.query.keyValue.findFirst({
        where: eq(keyValue.key, 'triggerUpdateChannelId'),
    });

    if (!kv) return;

    const channel = await guild.channels.fetch(kv.value);
    if (!channel?.isTextBased()) return;

    await channel.send(
        containerDisplay({ text: text, ...(color && { color }) }),
    );
}
