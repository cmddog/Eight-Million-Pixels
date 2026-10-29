import type {
    AccentColor,
    Command,
    ContainerOptions,
    PartialMessageOptions,
} from './types.js';
import { db } from './db/client.js';
import { loggingChannel, pseudonyms } from './db/schema.js';
import {
    type ActionRowBuilder,
    type ButtonBuilder,
    type ChatInputCommandInteraction,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import {
    adjectives,
    animals,
    colors,
    uniqueNamesGenerator,
} from 'unique-names-generator';

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

export async function getOrCreatePseudonym(userId: string) {
    const existing = await db.query.pseudonyms.findFirst({
        where: eq(pseudonyms.userId, userId),
    });

    if (existing) return existing.pseudonym;

    const all = await db.select().from(pseudonyms);
    let pseudonym: string;
    do {
        pseudonym = uniqueNamesGenerator({
            dictionaries: [colors, adjectives, animals],
            separator: '-',
            style: 'lowerCase',
        });
    } while (all.some((row) => row.pseudonym === pseudonym));

    await db.insert(pseudonyms).values({ userId, pseudonym });
    return pseudonym;
}

const ACCENT_COLORS: Record<AccentColor, number> = {
    error: 0xea5d5c,
    primary: 0x5865f2,
};

export function buildContainer({
    text,
    color,
}: ContainerOptions = {}): ContainerBuilder {
    const container = new ContainerBuilder();

    if (text) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(text),
        );
    }

    if (color) {
        container.setAccentColor(ACCENT_COLORS[color]);
    }

    return container;
}

export function buildTextDisplay(content: string) {
    return new TextDisplayBuilder().setContent(content);
}

export function toReplyOptions(
    components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[],
    flags?: MessageFlags,
): PartialMessageOptions {
    return {
        components,
        flags: MessageFlags.IsComponentsV2 | (flags ?? 0),
    };
}

export function containerDisplay(
    options?: ContainerOptions,
    flags?: MessageFlags,
): PartialMessageOptions {
    return toReplyOptions([buildContainer(options)], flags);
}

export async function log(
    interaction: ChatInputCommandInteraction,
    components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[],
) {
    const [row] = await db
        .select({ channelId: loggingChannel.loggingChannelId })
        .from(loggingChannel);

    if (!row) return;

    const channel = await interaction.guild?.channels.fetch(row.channelId);
    if (!channel?.isTextBased()) return;

    await channel.send({
        components,
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    });
}
