import {
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    type ChatInputCommandInteraction,
    ContainerBuilder,
    type GuildTextBasedChannel,
    MessageFlags,
    PermissionFlagsBits,
    SectionBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    log,
} from '../../utils.js';

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
        return interaction.reply(
            containerDisplay(
                {
                    text: `I don't have permission to send messages in ${channel}`,
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            ),
        );
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (replyToId) {
        try {
            await channel.messages.fetch(replyToId);
        } catch {
            return interaction.editReply(
                containerDisplay(
                    {
                        text: `No message with id \`${replyToId}\` found in ${channel}`,
                        color: 'error',
                    },
                    MessageFlags.Ephemeral,
                ),
            );
        }
    }

    const sent = await channel.send({
        content,
        ...(replyToId && {
            reply: { messageReference: replyToId, failIfNotExists: true },
        }),
    });

    void log(interaction.guild!, [
        new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            '### Sent a Message as EMP',
                        ),
                    )
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setURL(sent.url)
                            .setLabel('Jump')
                            .setStyle(ButtonStyle.Link),
                    ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${interaction.user} in ${interaction.channel}: ${content}`,
                ),
            ),
    ]);

    return interaction.editReply({
        components: [
            buildContainer({ color: 'primary' }).addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(buildTextDisplay('Message sent'))
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setLabel('Jump')
                            .setStyle(ButtonStyle.Link)
                            .setURL(sent.url),
                    ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
    });
}
