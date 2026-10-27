import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    type ChatInputCommandInteraction,
    type GuildTextBasedChannel,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('say')
    .setDescription(
        'Sends a message as EMP. Optionally provide a channel and a message to reply to',
    )
    .addStringOption((option) =>
        option
            .setName('content')
            .setDescription('The message to send')
            .setMaxLength(2_000)
            .setRequired(true),
    )
    .addChannelOption((option) =>
        option
            .setName('channel')
            .setDescription(
                'The channel to send the message in. Sends in current channel if not provided',
            )
            .addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((option) =>
        option
            .setName('reply-to')
            .setDescription('The ID of a message to reply to'),
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
        await interaction.reply({
            content: `I don't have permission to send messages in ${channel}.`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (replyToId) {
        try {
            await channel.messages.fetch(replyToId);
        } catch {
            await interaction.editReply(
                `No message with id \`${replyToId}\` found in ${channel}.`,
            );
            return;
        }
    }

    const sent = await channel.send({
        content,
        ...(replyToId && {
            reply: { messageReference: replyToId, failIfNotExists: true },
        }),
    });

    await interaction.editReply({
        content: 'Message sent.',
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
