import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { containerDisplay } from '../../utils.js';
import { db } from '../../db/client.js';
import { eq, like, or } from 'drizzle-orm';
import { triggers } from '../../db/schema.js';
import {
    insertTrigger,
    isSubscribed,
    isValidName,
    subscribeToTrigger,
} from './trigger.js';

export async function handleSubscribe(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description');

    if (!isValidName(name)) {
        return interaction.reply(
            containerDisplay(
                {
                    text:
                        'Name must only include letters and spaces, please try again.' +
                        (description
                            ? ` In case you want to copy it, here is the description you wrote: **${description}**`
                            : ''),
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            ),
        );
    }

    await interaction.deferReply({
        flags: [MessageFlags.Ephemeral],
    });
    const matches = await db.query.triggers.findMany({
        where: or(
            like(triggers.name, `%${name}%`),
            like(triggers.description, `%${name}%`),
        ),
    });

    const exactMatch = matches.find((m) => m.name === name);

    if (matches.length === 0) {
        if (!description) {
            return interaction.editReply(
                containerDisplay({
                    text: 'You must provide a description to add a new trigger',
                    color: 'error',
                }),
            );
        }
        await insertTrigger(name, description, interaction);
        return interaction.editReply(
            containerDisplay({
                text: `Successfully added and subscribed to new trigger **${name}**`,
                color: 'primary',
            }),
        );
    } else if (exactMatch) {
        if (await isSubscribed(exactMatch.name, interaction.user.id)) {
            return interaction.editReply(
                containerDisplay({
                    text: `You are already subscribed to **${name}**`,
                    color: 'error',
                }),
            );
        }

        await subscribeToTrigger(exactMatch.name, interaction.user.id);
        return interaction.editReply(
            containerDisplay({
                text: `Successfully subscribed to **${name}**`,
                color: 'primary',
            }),
        );
    } else {
        const COMPONENT_LIMIT = 40;
        const FIXED_COST = 5;
        const COST_PER_SECTION = 5;
        const OMISSION_COST = 1;

        const fitsWithinLimit =
            FIXED_COST + matches.length * COST_PER_SECTION <= COMPONENT_LIMIT;
        const maxWithOmission = Math.floor(
            (COMPONENT_LIMIT - FIXED_COST - OMISSION_COST) / COST_PER_SECTION,
        );

        const displayedMatches = fitsWithinLimit
            ? matches
            : matches.slice(0, maxWithOmission);
        const omittedCount = fitsWithinLimit
            ? 0
            : matches.length - maxWithOmission;

        const sections = displayedMatches.map((m) =>
            new ContainerBuilder().addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**${m.name}**`),
                        new TextDisplayBuilder().setContent(`${m.description}`),
                    )
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setCustomId(`update:${m.name}`)
                            .setLabel('Subscribe')
                            .setStyle(ButtonStyle.Secondary),
                    ),
            ),
        );

        const body = [
            new TextDisplayBuilder().setContent(
                '## One or More Triggers Including That Name Already Exist',
            ),
            new TextDisplayBuilder().setContent(
                'If any of these match what you were trying to add, consider subscribing to one of them instead:',
            ),
            ...sections,
        ];

        if (omittedCount > 0) {
            body.push(
                new TextDisplayBuilder().setContent(
                    `*${omittedCount} more result${omittedCount === 1 ? '' : 's'} omitted.*`,
                ),
            );
        }

        const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
                .setCustomId('cancel'),
            new ButtonBuilder()
                .setLabel('None Match — Create New Trigger')
                .setStyle(ButtonStyle.Primary)
                .setCustomId('insert'),
        );

        const message = await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [...body, actions],
        });

        try {
            const btn = await message.awaitMessageComponent({
                componentType: ComponentType.Button,
                time: 60_000,
            });

            const [action, value] = btn.customId.split(':');

            if (action === 'insert') {
                if (!description) {
                    return btn.update(
                        containerDisplay({
                            text: 'You must provide a description to add a new trigger',
                            color: 'error',
                        }),
                    );
                }
                await btn.update(containerDisplay({ text: 'Inserting...' }));
                await insertTrigger(name, description, interaction);
                return interaction.editReply(
                    containerDisplay({
                        text: `Successfully added new trigger **${name}**`,
                        color: 'primary',
                    }),
                );
            } else if (action === 'update') {
                await btn.update(containerDisplay({ text: 'Subscribing...' }));

                const toUpdate = await db.query.triggers.findFirst({
                    where: eq(triggers.name, value!),
                });
                if (!toUpdate) {
                    return interaction.editReply(
                        containerDisplay({
                            text: `The trigger **${value}** no longer exists`,
                            color: 'error',
                        }),
                    );
                }

                if (await isSubscribed(toUpdate.name, interaction.user.id)) {
                    return interaction.editReply(
                        containerDisplay({
                            text: `You are already subscribed to **${value}**`,
                            color: 'error',
                        }),
                    );
                }

                await subscribeToTrigger(toUpdate.name, interaction.user.id);
                return interaction.editReply(
                    containerDisplay({
                        text: `Successfully subscribed to **${value}**`,
                        color: 'primary',
                    }),
                );
            } else {
                return btn.update(
                    containerDisplay({ text: 'Interaction cancelled by user' }),
                );
            }
        } catch {
            return interaction.editReply(
                containerDisplay({ text: 'Interaction timed out' }),
            );
        }
    }
}
