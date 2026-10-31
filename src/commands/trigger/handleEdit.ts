import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { db } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import { triggers } from '../../db/schema.js';
import {
    buildContainer,
    buildTextDisplay,
    containerDisplay,
} from '../../utils.js';
import { isValidName, verifyAdmin } from './trigger.js';

export async function handleEdit(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
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
            const existing = await db.query.triggers.findFirst({
                where: eq(triggers.name, newValue),
            });
            if (existing)
                return interaction.editReply(
                    containerDisplay({
                        text: `There is already a trigger called **${newValue}**. Did you mean to use \`/trigger merge\`?`,
                    }),
                );

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
                flags: MessageFlags.IsComponentsV2,
            });
        }
    }
}
