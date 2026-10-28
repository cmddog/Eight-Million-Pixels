import {
    ActionRowBuilder,
    type AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    ContainerBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { db } from '../../db/index.js';
import { triggers } from '../../db/schema.js';
import { eq, like, or } from 'drizzle-orm';

export const data = new SlashCommandBuilder()
    .addSubcommand((sub) =>
        sub
            .setName('subscribe')
            .setDescription(
                "Subscribe to a trigger or add a new one if it doesn't exist yet. Name must be limited to letters and spaces",
            )
            .addStringOption((o) =>
                o
                    .setName('name')
                    .setDescription(
                        'The name of the trigger. (e.g. Spiders. Prefer using an easy to understand noun over ' +
                            'something like Arachnophobia, so the list is easier to skim)',
                    )
                    .setMinLength(3)
                    .setMaxLength(20)
                    .setRequired(true),
            )
            .addStringOption((o) =>
                o
                    .setName('description')
                    .setDescription(
                        'A more detailed description of the trigger. (e.g. Any imagery depicting ' +
                            'spiders or spider-adjacent things)',
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
                    .setDescription('The name of the trigger to remove')
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
                    .setName('target_name')
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
                    .setName('new_value')
                    .setDescription('A new value for the name/description')
                    .setMinLength(3)
                    .setMaxLength(512)
                    .setRequired(true),
            ),
    )
    .addSubcommand((sub) =>
        sub
            .setName('merge')
            .setDescription('Used to merge duplicate triggers')
            .addStringOption((o) =>
                o
                    .setName('source_name')
                    .setDescription(
                        'The name of the trigger to transfer the IDs FROM that will subsequently be deleted',
                    )
                    .setAutocomplete(true)
                    .setRequired(true),
            )
            .addStringOption((o) =>
                o
                    .setName('target_name')
                    .setDescription(
                        'The name of the trigger to transfer the IDs TO that will remain',
                    )
                    .setAutocomplete(true)
                    .setRequired(true),
            ),
    )
    .addSubcommand((sub) =>
        sub.setName('list').setDescription('List all triggers'),
    )
    .addSubcommand((sub) =>
        sub
            .setName('help')
            .setDescription(
                'Displays an explanation of how the trigger system works.',
            ),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    switch (interaction.options.getSubcommand()) {
        case 'subscribe':
            return handleSubscribe(interaction);
        case 'unsubscribe':
            return handleUnsubscribe(interaction);
        case 'edit':
            return handleEdit(interaction);
        case 'merge':
            return handleMerge(interaction);
        case 'list':
            return handleList(interaction);
        case 'help':
            return handleHelp(interaction);
    }
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    const results = await db
        .select({ name: triggers.name })
        .from(triggers)
        .where(like(triggers.name, `%${focused}%`))
        .limit(25);
    await interaction.respond(
        results.map((r) => ({ name: r.name, value: r.name })),
    );
}

async function handleSubscribe(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description');

    if (!/^[A-Za-z ]+$/.test(name)) {
        return interaction.editReply(
            `⛔ Name must only include letters and spaces, please try again. In case you want to copy it, here is the description you wrote: \`${interaction.options.getString('description')}\``,
        );
    }

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
                '⛔ You must provide a description to add a new trigger',
            );
        }
        await insertTrigger(name, description, interaction.user.id);
        return interaction.editReply(
            `Successfully added new trigger \`${name}\``,
        );
    } else if (exactMatch) {
        if (exactMatch.subscribers.includes(interaction.user.id)) {
            return interaction.editReply(
                `You are already subscribed to \`${name}\``,
            );
        }

        await subscribeToTrigger(exactMatch, interaction.user.id);
        return interaction.editReply(`Successfully subscribed to \`${name}\``);
    } else {
        const sections = matches.map((m) =>
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
            new SeparatorBuilder()
                .setDivider(false)
                .setSpacing(SeparatorSpacingSize.Large),
            ...sections,
        ];
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
                    return interaction.editReply(
                        '⛔ You must provide a description to add a new trigger',
                    );
                }
                await btn.update({ content: 'Inserting...', components: [] });
                await insertTrigger(name, description, interaction.user.id);
                return interaction.editReply(
                    `Successfully added new trigger \`${name}\``,
                );
            } else if (action === 'update') {
                await btn.update({ content: 'Subscribing...', components: [] });

                const toUpdate = await db.query.triggers.findFirst({
                    where: eq(triggers.name, value!),
                });
                if (!toUpdate) {
                    return interaction.editReply(
                        `The trigger \`${value}\` no longer exists`,
                    );
                }

                if (toUpdate.subscribers.includes(interaction.user.id)) {
                    return interaction.editReply(
                        `You are already subscribed to \`${name}\``,
                    );
                }

                await subscribeToTrigger(toUpdate, interaction.user.id);
                return interaction.editReply(
                    `Successfully subscribed to \`${value}\``,
                );
            } else {
                return interaction.editReply('Interaction cancelled');
            }
        } catch {
            return interaction.editReply({
                content: 'Interaction timed out',
                components: [],
            });
        }
    }
}

async function handleUnsubscribe(interaction: ChatInputCommandInteraction) {}

async function handleEdit(interaction: ChatInputCommandInteraction) {}

async function handleMerge(interaction: ChatInputCommandInteraction) {}

async function handleList(interaction: ChatInputCommandInteraction) {}

async function handleHelp(interaction: ChatInputCommandInteraction) {}

async function insertTrigger(
    name: string,
    description: string,
    userId: string,
) {
    await db
        .insert(triggers)
        .values({ name, description, subscribers: userId });
}

async function subscribeToTrigger(
    record: { name: string; subscribers: string },
    userId: string,
) {
    const newSubs = record.subscribers.concat(`,${userId}`);
    await db
        .update(triggers)
        .set({ subscribers: newSubs })
        .where(eq(triggers.name, record.name));
}
