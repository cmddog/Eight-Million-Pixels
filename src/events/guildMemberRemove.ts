import { Events, type GuildMember, SeparatorBuilder } from 'discord.js';
import { db } from '../db/client.js';
import { triggers, triggerSubscribers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { buildContainer, buildTextDisplay, log } from '../utils.js';

export const name = Events.GuildMemberRemove;

export async function execute(member: GuildMember) {
    const memberSubs = await db.query.triggerSubscribers.findMany({
        where: eq(triggerSubscribers.userId, member.id),
    });

    await db
        .delete(triggerSubscribers)
        .where(eq(triggerSubscribers.userId, member.id));

    for (const sub of memberSubs) {
        const remaining = await db.query.triggerSubscribers.findFirst({
            where: eq(triggerSubscribers.triggerName, sub.triggerName),
        });
        if (remaining) continue;

        const trigger = await db.query.triggers.findFirst({
            where: eq(triggers.name, sub.triggerName),
        });
        if (!trigger) continue;

        await db.delete(triggers).where(eq(triggers.name, trigger.name));

        void log(member.guild, [
            buildContainer({ text: '### Trigger Deleted' })
                .addTextDisplayComponents(
                    buildTextDisplay(
                        'The last subscriber of this trigger left the server and it was deleted:',
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(
                    buildTextDisplay(`**${trigger.name}**`),
                    buildTextDisplay(`${trigger.description}`),
                ),
        ]);
    }
}
