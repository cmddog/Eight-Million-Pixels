import {
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    Collection,
    type InteractionEditReplyOptions,
    type InteractionReplyOptions,
    type MessageCreateOptions,
    SlashCommandBuilder,
} from 'discord.js';

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command>;
    }
}

interface Command {
    data: SlashCommandBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export type AccentColor = 'error' | 'primary';

interface ContainerOptions {
    text?: string;
    color?: AccentColor;
}

type PartialMessageOptions = Pick<
    InteractionReplyOptions &
        InteractionEditReplyOptions &
        MessageCreateOptions,
    'components' | 'flags'
>;
