import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { db } from '../../db/client.js';
import { triggers } from '../../db/schema.js';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
    fireAndForget,
} from '../../utils.js';
import { isValidName, nameEquals, sendUpdate } from '../trigger/trigger.js';

export async function handleEdit(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    const currName = interaction.options.getString('current-name', true);
    const newName = interaction.options.getString('new-name');
    const newDescription = interaction.options.getString('new-description');
    const withAnnouncement =
        interaction.options.getBoolean('with-announcement');

    if (!newName && !newDescription)
        return interaction.reply(
            containerDisplay(
                {
                    text: 'You need to edit at least one of the properties',
                    color: 'error',
                },
                MessageFlags.Ephemeral,
            ),
        );

    await interaction.deferReply();

    const trigger = await db.query.triggers.findFirst({
        where: nameEquals(triggers.name, currName),
    });
    if (!trigger)
        return interaction.editReply(
            containerDisplay({
                text: `There is no trigger called **${currName}**`,
                color: 'error',
            }),
        );

    if (newDescription) {
        await db
            .update(triggers)
            .set({ description: newDescription })
            .where(nameEquals(triggers.name, currName));
    }

    if (newName) {
        const existing = await db.query.triggers.findFirst({
            where: nameEquals(triggers.name, newName),
        });
        if (existing && trigger.name !== existing.name)
            return interaction.editReply(
                containerDisplay({
                    text: `There is already a trigger called **${existing.name}**. Did you mean to use \`/trigger merge\`?`,
                }),
            );

        if (!isValidName(newName))
            return interaction.editReply(
                containerDisplay({
                    text: 'Name must only include letters and spaces',
                    color: 'error',
                }),
            );

        await db
            .update(triggers)
            .set({ name: newName })
            .where(nameEquals(triggers.name, currName));
    }

    if (newName && newDescription) {
        if (withAnnouncement)
            fireAndForget(
                sendUpdate(
                    `### Trigger changed\nRenamed from **${trigger.name}** to **${newName}**\n\nDescription changed from:\n> ${trigger.description}\nTo:\n> ${newDescription}`,
                    interaction.guild!,
                ),
            );

        return interaction.editReply({
            components: [
                buildContainer({
                    text: `### Description and name of trigger **${trigger.name}** successfully changed\nRenamed from **${trigger.name}** to **${newName}**`,
                    color: 'primary',
                }).addTextDisplayComponents(
                    buildTextDisplay(
                        `Description changed from:\n> ${trigger.description}`,
                    ),
                    buildTextDisplay(`To:\n> ${newDescription}`),
                ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    } else if (newName) {
        if (withAnnouncement)
            fireAndForget(
                sendUpdate(
                    `Name of trigger **${trigger.name}** changed to **${newName}**`,
                    interaction.guild!,
                ),
            );

        return interaction.editReply(
            containerDisplay({
                text: `Name of trigger successfully changed from **${trigger.name}** to **${newName}**`,
                color: 'primary',
            }),
        );
    } else {
        if (withAnnouncement)
            fireAndForget(
                sendUpdate(
                    `### Description of trigger *${trigger.name}* changed\nBefore:\n> ${trigger.description}\nAfter:\n> ${newDescription}`,
                    interaction.guild!,
                ),
            );

        return interaction.editReply({
            components: [
                buildContainer({
                    text: `### Description of trigger **${trigger.name}** successfully changed`,
                    color: 'primary',
                }).addTextDisplayComponents(
                    buildTextDisplay(`Before:\n> ${trigger.description}`),
                    buildTextDisplay(`After:\n> ${newDescription}`),
                ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}
