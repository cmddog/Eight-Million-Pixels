import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    MessageFlags,
} from 'discord.js';
import { db } from '../../db/client.js';
import { triggers, triggerSubscribers } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
} from '../../utils.js';

export async function handleList(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    const PAGE_SIZE = 5;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mine = interaction.options.getBoolean('mine');
    const all = mine
        ? db
              .select({
                  name: triggers.name,
                  description: triggers.description,
              })
              .from(triggers)
              .innerJoin(
                  triggerSubscribers,
                  eq(triggerSubscribers.triggerName, triggers.name),
              )
              .where(eq(triggerSubscribers.userId, interaction.user.id))
              .orderBy(triggers.name)
              .all()
        : db.select().from(triggers).orderBy(triggers.name).all();

    if (all.length === 0)
        return interaction.editReply(
            containerDisplay({
                text: mine
                    ? "You aren't subscribed to any triggers yet"
                    : 'No triggers yet',
            }),
        );

    const pages = Math.ceil(all.length / PAGE_SIZE);
    let page = 0;

    const buildContent = (p: number, disabled: boolean = false) => {
        const page = all.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
        const components = [];

        if (mine) components.push(buildTextDisplay('## Your Triggers'));

        page.forEach((t) => {
            components.push(
                buildContainer({ text: `**${t.name}**\n${t.description}` }),
            );
        });

        if (pages > 1) {
            components.push(
                buildTextDisplay(
                    `*Showing ${page.length} of ${all.length} · Page ${p + 1} of ${pages}*`,
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
