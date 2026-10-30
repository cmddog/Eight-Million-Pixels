import { Events, type GuildMember, SeparatorBuilder } from 'discord.js';
import { db } from '../db/client.js';
import { triggers } from '../db/schema.js';
import { eq, like } from 'drizzle-orm';
import { buildContainer, buildTextDisplay, log } from '../utils.js';

export const name = Events.GuildMemberRemove;

export async function execute(member: GuildMember) {
    const allTriggers = await db.query.triggers.findMany({
        where: like(triggers.subscribers, `%${member.id}%`),
    });

    for (const trigger of allTriggers) {
        const newSubs = trigger.subscribers
            .split(',')
            .filter((id) => id !== member.id);

        if (newSubs.length === 0) {
            await db.delete(triggers).where(eq(triggers.name, trigger.name));

            void log(member.guild, [
                buildContainer({ text: '### Trigger Deleted' })
                    .addTextDisplayComponents(
                        buildTextDisplay(
                            'The last subscribe of this trigger left the server and it was deleted:',
                        ),
                    )
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addTextDisplayComponents(
                        buildTextDisplay(`**${name}**`),
                        buildTextDisplay(`${trigger.description}`),
                    ),
            ]);
        } else {
            await db
                .update(triggers)
                .set({ subscribers: newSubs.join(',') })
                .where(eq(triggers.name, trigger.name));
        }
    }
}
