import type { AutocompleteInteraction } from 'discord.js';
import { db } from '../../db/client.js';
import { triggers } from '../../db/schema.js';
import { like } from 'drizzle-orm';

export async function triggerAutocomplete(
    interaction: AutocompleteInteraction,
): Promise<unknown> {
    const focused = interaction.options.getFocused();
    const results = await db
        .select({ name: triggers.name })
        .from(triggers)
        .where(like(triggers.name, `%${focused}%`))
        .limit(25);
    return interaction.respond(
        results.map((r) => ({ name: r.name, value: r.name })),
    );
}
