import {
    ActionRowBuilder,
    type AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    ContainerBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SectionBuilder,
    SeparatorBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
} from 'discord.js';
import { db } from '../../db/client.js';
import { pseudonyms, triggers } from '../../db/schema.js';
import { eq, like, or } from 'drizzle-orm';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    getOrCreatePseudonym,
    log,
} from '../../utils.js';
import type { PartialMessageOptions } from '../../types.js';

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
        sub.setName('list').setDescription('List all triggers'),
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
    edit: handleEdit,
    delete: handleDelete,
    merge: handleMerge,
    'get-user': handleGetUser,
    list: handleList,
    help: handleHelp,
};

export async function execute(interaction: ChatInputCommandInteraction) {
    return handlers[interaction.options.getSubcommand()]?.(interaction);
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
        if (exactMatch.subscribers.includes(interaction.user.id)) {
            return interaction.editReply(
                containerDisplay({
                    text: `You are already subscribed to **${name}**`,
                    color: 'error',
                }),
            );
        }

        await subscribeToTrigger(exactMatch, interaction.user.id);
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
                return btn.editReply(
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
                    return btn.editReply(
                        containerDisplay({
                            text: `The trigger **${value}** no longer exists`,
                            color: 'error',
                        }),
                    );
                }

                if (toUpdate.subscribers.includes(interaction.user.id)) {
                    return btn.editReply(
                        containerDisplay({
                            text: `You are already subscribed to **${value}**`,
                            color: 'error',
                        }),
                    );
                }

                await subscribeToTrigger(toUpdate, interaction.user.id);
                return btn.editReply(
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

async function handleUnsubscribe(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.options.getString('name', true);

    const trigger = await db.query.triggers.findFirst({
        where: eq(triggers.name, name),
    });
    if (!trigger) {
        return interaction.editReply(
            containerDisplay({
                text: `The trigger ${name} doesn't exist`,
                color: 'error',
            }),
        );
    }

    const oldSubs = trigger.subscribers.split(',');
    const newSubs = oldSubs.filter((id) => id !== interaction.user.id);

    if (newSubs.length === 0) {
        await db.delete(triggers).where(eq(triggers.name, name));

        void log(interaction, [
            buildContainer({ text: '### Trigger Deleted' })
                .addTextDisplayComponents(
                    buildTextDisplay(
                        'This trigger lost its last subscriber and was deleted:',
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(
                    buildTextDisplay(`**${name}**`),
                    buildTextDisplay(`${trigger.description}`),
                ),
        ]);

        return interaction.editReply(
            containerDisplay({
                text: `Successfully unsubscribed from **${name}**. You were the last subscriber and the trigger has been deleted`,
                color: 'primary',
            }),
        );
    } else {
        await db
            .update(triggers)
            .set({ subscribers: newSubs.join(',') })
            .where(eq(triggers.name, name));
        return interaction.editReply(
            containerDisplay({
                text: `Successfully unsubscribed from **${name}**`,
                color: 'primary',
            }),
        );
    }
}

async function handleEdit(interaction: ChatInputCommandInteraction) {
    if (!verifyAdmin(interaction)) return;
    await interaction.deferReply();

    const name = interaction.options.getString('name', true).trim();
    const property = interaction.options.getString('property', true) as
        'name' | 'description';
    const newValue = interaction.options.getString('new-value', true).trim();

    const trigger = await db.query.triggers.findFirst({
        where: eq(triggers.name, name),
    });
    if (!trigger)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called ${name}`,
                color: 'error',
            }),
        );
    switch (property) {
        case 'name': {
            if (!isValidName(newValue))
                return interaction.editReply(
                    containerDisplay({
                        text: 'Name must only include letters and spaces',
                        color: 'error',
                    }),
                );
            if (newValue.length > 20)
                return interaction.editReply(
                    containerDisplay({
                        text: 'The name of a trigger must not be longer than 20 characters',
                        color: 'error',
                    }),
                );
            await db
                .update(triggers)
                .set({ name: newValue })
                .where(eq(triggers.name, name));
            return interaction.editReply(
                containerDisplay({
                    text: `Name of trigger successfully changed from **${name}** to **${newValue}**`,
                    color: 'primary',
                }),
            );
        }
        case 'description': {
            if (newValue.length < 10)
                return interaction.editReply(
                    containerDisplay({
                        text: 'The description of a trigger must have at least 10 characters',
                        color: 'error',
                    }),
                );
            await db
                .update(triggers)
                .set({ description: newValue })
                .where(eq(triggers.name, name));
            return interaction.editReply({
                components: [
                    buildContainer({
                        text: `### Description of trigger **${name}** successfully changed`,
                        color: 'primary',
                    }).addTextDisplayComponents(
                        buildTextDisplay(`Before:\n> ${trigger.description}`),
                        buildTextDisplay(`After:\n> ${newValue}`),
                    ),
                ],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
        }
    }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
    if (!verifyAdmin(interaction)) return;
    await interaction.deferReply();

    const name = interaction.options.getString('name', true);
    const trigger = await db.query.triggers.findFirst({
        where: eq(triggers.name, name),
    });

    if (!trigger)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called ${name}`,
                color: 'error',
            }),
        );

    const subscriberCount = trigger.subscribers.split(',').length;
    const buildConfirmationReply: (
        confirmed: boolean,
    ) => PartialMessageOptions = (confirmed: boolean) => ({
        components: [
            buildContainer({
                text: `Are you sure you want to delete the trigger **${name}**? It currently has ${subscriberCount} ${subscriberCount === 1 ? 'subscriber' : 'subscriber'}.`,
                color: 'error',
            }).addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().setComponents(
                    new ButtonBuilder()
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId('cancel')
                        .setDisabled(confirmed),
                    new ButtonBuilder()
                        .setLabel(confirmed ? 'Confirmed' : 'Confirm')
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId('confirm')
                        .setDisabled(confirmed),
                ),
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
    });
    const message = await interaction.editReply(buildConfirmationReply(false));

    try {
        const btn = await message.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60_000,
            componentType: ComponentType.Button,
        });

        if (btn.customId === 'confirm') {
            await btn.update(buildConfirmationReply(true));
            await db.delete(triggers).where(eq(triggers.name, name));
            return btn.followUp(
                containerDisplay({
                    text: `Successfully deleted trigger **${name}**`,
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

async function handleMerge(interaction: ChatInputCommandInteraction) {
    if (!verifyAdmin(interaction)) return;

    const sourceName = interaction.options.getString('source-name', true);
    const targetName = interaction.options.getString('target-name', true);

    if (sourceName === targetName)
        return interaction.reply(
            containerDisplay(
                {
                    text: 'Source and target cannot be the same',
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            ),
        );
    await interaction.deferReply();

    const source = await db.query.triggers.findFirst({
        where: eq(triggers.name, sourceName),
    });
    if (!source)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called **${sourceName}**`,
                color: 'error',
            }),
        );

    const target = await db.query.triggers.findFirst({
        where: eq(triggers.name, targetName),
    });
    if (!target)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called **${targetName}**`,
                color: 'error',
            }),
        );

    const sourceSubs = source.subscribers.split(',');
    const newTargetSubs = [
        ...new Set(sourceSubs.concat(target.subscribers.split(','))),
    ];

    await db
        .update(triggers)
        .set({ subscribers: newTargetSubs.join(',') })
        .where(eq(triggers.name, targetName));
    await db.delete(triggers).where(eq(triggers.name, sourceName));
    return interaction.editReply(
        containerDisplay({
            text: `Transferred unique subscribers to **${targetName}** and deleted **${sourceName}**`,
            color: 'primary',
        }),
    );
}

async function handleGetUser(interaction: ChatInputCommandInteraction) {
    if (!verifyAdmin(interaction)) return;
    await interaction.deferReply();

    const pseudonym = interaction.options.getString('pseudonym', true);

    const row = await db.query.pseudonyms.findFirst({
        where: eq(pseudonyms.pseudonym, pseudonym),
    });
    if (!row)
        return interaction.editReply(
            containerDisplay({
                text: `There is no user with the pseudonym **${pseudonym}**`,
                color: 'error',
            }),
        );

    return interaction.editReply(
        containerDisplay({
            text: `The user with the pseudonym **${pseudonym}** is <@${row.userId}>`,
        }),
    );
}

async function handleList(interaction: ChatInputCommandInteraction) {
    const PAGE_SIZE = 5;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const all = db.select().from(triggers).orderBy(triggers.name).all();
    if (all.length === 0)
        return interaction.editReply(
            containerDisplay({ text: 'No triggers yet' }),
        );

    const pages = Math.ceil(all.length / PAGE_SIZE);
    let page = 0;

    const buildContent = (p: number, disabled: boolean = false) => {
        const page = all.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
        const components = [];

        page.forEach((t) => {
            components.push(
                buildContainer({ text: `**${t.name}**\n${t.description}` }),
            );
        });

        if (pages > 1) {
            components.push(
                buildTextDisplay(
                    `*Showing ${PAGE_SIZE} of ${all.length} · Page ${p + 1} of ${pages}*`,
                ),
            );
            components.push(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(p === 0 || disabled),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(p === pages - 1 || disabled),
                ),
            );
        }

        return components;
    };

    const reply = await interaction.editReply({
        components: [...buildContent(page)],
        flags: MessageFlags.IsComponentsV2,
    });

    if (pages <= 1) return;

    const collector = reply.createMessageComponentCollector({
        time: 120_000,
        componentType: ComponentType.Button,
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'prev') page--;
        else page++;
        await i.update({ components: [...buildContent(page)] });
    });

    collector.on('end', () =>
        interaction.editReply({ components: [...buildContent(page, true)] }),
    );
    return;
}

async function handleHelp(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [
            buildTextDisplay(
                '# Trigger Warning System\n`/trigger` and its subcommands manage trigger warnings for members in this ' +
                    'server, letting anyone easily and mostly anonymously (more on this below) add and subscribe to ' +
                    'triggers. If you frequent the server it is recommended to occasionally check the list.\n' +
                    'Here is an explanation of what each command does:',
            ),
            buildContainer({
                text:
                    '**/trigger subscribe** <name> [description]\n' +
                    'Subscribes you to a trigger, creating it if it doesn’t exist yet. Triggers are shared — anyone ' +
                    'affected can subscribe, and they persist as long as at least one member is subscribed, ' +
                    'regardless of who originally created them.',
            }),
            buildContainer({
                text:
                    '**/trigger unsubscribe** <name>\n' +
                    'Unsubscribes you from a trigger. If you were the last subscriber, the trigger is deleted.',
            }),
            buildContainer({
                text:
                    '**/trigger list**\n' +
                    'Displays a paginated list of all current triggers',
            }),
            buildContainer({
                text: '**/trigger help**\n' + 'Displays this explanation',
            }),
            buildContainer({
                text:
                    '**Other subcommands**\n' +
                    'All other subcommands are Admin-only and you can safely ignore them. If you think the wording of a ' +
                    "trigger's description or name are unclear or should be adjusted for another reason, please let a " +
                    'staff member know.',
            }),
            new SeparatorBuilder(),
            buildTextDisplay(
                '## Anonymity\n' +
                    'Due to technical and moderational reasons we cannot assure full anonymity. We have however made ' +
                    'sure to make the system as anonymous as possible under those circumstances: The `/trigger ' +
                    'subscribe`, `unsubscribe`, `list`, and `help` commands are ephemeral, meaning you can use them ' +
                    'anywhere without other members being able to see. Uses of `/trigger subscribe` are logged ' +
                    'pseudonymously. Only Administrators have the ability to tie a pseudonym back to you and this will ' +
                    'never be done, unless someone is abusing the system.',
            ),
        ],
    });
}

async function insertTrigger(
    name: string,
    description: string,
    interaction: ChatInputCommandInteraction,
) {
    await db
        .insert(triggers)
        .values({ name, description, subscribers: interaction.user.id });

    const pseudonym = await getOrCreatePseudonym(interaction.user.id);
    void log(interaction, [
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

function isValidName(str: string): boolean {
    return /^[A-Za-z ]+$/.test(str);
}

function verifyAdmin(interaction: ChatInputCommandInteraction) {
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
    return hasAdmin;
}
