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
import type { AccentColor } from '../../types.js';

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
    .addBooleanOption((o) =>
        o
            .setName('in-container')
            .setDescription(
                'Whether the message should be sent in a container',
            ),
    )
    .addStringOption((o) =>
        o
            .setName('color')
            .setDescription(
                'Which color the container should have. Does nothing if in-container is false',
            )
            .setChoices(
                { name: 'Primary', value: 'primary' },
                { name: 'Error', value: 'error' },
            ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const content = interaction.options.getString('content', true);
    const channel =
        interaction.options.getChannel('channel', false, [
            ChannelType.GuildText,
        ]) ?? (interaction.channel as GuildTextBasedChannel);
    const replyToId = interaction.options.getString('reply-to');
    const inContainer = interaction.options.getBoolean('in-container');
    const color = interaction.options.getString('color') as
        AccentColor | undefined;

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

    let sent;
    if (!inContainer) {
        sent = await channel.send({
            content,
            ...(replyToId && {
                reply: { messageReference: replyToId, failIfNotExists: true },
            }),
        });
    } else {
        sent = await channel.send(
            containerDisplay({ text: content, ...(color && { color }) }),
        );
    }

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
                    `${interaction.user} in ${interaction.channel}:\n${content}`,
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
