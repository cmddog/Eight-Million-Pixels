import type { ChatInputCommandInteraction } from 'discord.js';
import { db } from '../../db/client.js';
import { eq } from 'drizzle-orm';
import { pseudonyms } from '../../db/schema.js';
import { containerDisplay } from '../../utils.js';
import { verifyAdminOrOther } from './trigger-mod.js';

export async function handleGetUser(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    if (!verifyAdminOrOther(interaction)) return;
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
