import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    type GuildTextBasedChannel,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { log } from '../../utils.js';

export const data = new SlashCommandBuilder()
    .setName('say')
    .setDescription(
        'Sends a message as EMP. Optionally provide a channel and a message to reply to',
    )
    .addStringOption((o) =>
        o
            .setName('content')
            .setDescription('The message to send')
            .setMaxLength(2_000)
            .setRequired(true),
    )
    .addChannelOption((o) =>
        o
            .setName('channel')
            .setDescription(
                'The channel to send the message in. Sends in current channel if not provided',
            )
            .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((o) =>
        o.setName('reply-to').setDescription('The ID of a message to reply to'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const content = interaction.options.getString('content', true);
    const channel =
        interaction.options.getChannel('channel', false, [
            ChannelType.GuildText,
        ]) ?? (interaction.channel as GuildTextBasedChannel);
    const replyToId = interaction.options.getString('reply-to');

    if (
        !channel
            .permissionsFor(interaction.client.user)
            ?.has(PermissionFlagsBits.SendMessages)
    ) {
        return interaction.reply({
            content: `I don't have permission to send messages in ${channel}.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (replyToId) {
        try {
            await channel.messages.fetch(replyToId);
        } catch {
            return interaction.editReply(
                `No message with id \`${replyToId}\` found in ${channel}.`,
            );
        }
    }

    const sent = await channel.send({
        content,
        ...(replyToId && {
            reply: { messageReference: replyToId, failIfNotExists: true },
        }),
    });

    void log(
        new EmbedBuilder()
            .setAuthor({
                name: interaction.user.username,
                iconURL:
                    interaction.user.avatarURL() ??
                    'https://crouton.net/crouton.png',
            })
            .setTitle('Sent a Message as EMP')
            .setURL(sent.url)
            .setDescription(content),
        interaction,
    );

    return interaction.editReply({
        content: 'Message sent',
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel('Jump')
                    .setStyle(ButtonStyle.Link)
                    .setURL(sent.url),
            ),
        ],
    });
}
