import {
    type ChatInputCommandInteraction,
    MessageFlags,
    SeparatorBuilder,
} from 'discord.js';
import { buildContainer, buildTextDisplay } from '../../utils.js';

export async function handleHelp(
    interaction: ChatInputCommandInteraction,
): Promise<unknown> {
    return interaction.reply({
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
                    '**/trigger list** [mine]\n' +
                    "Displays all triggers, or only the ones you're subscribed to if `mine` is set",
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
                    'pseudonymously. Only Administrators have the ability to tie a pseudonym back to a member and this will ' +
                    'never be done, unless someone is abusing the system.',
            ),
            new SeparatorBuilder(),
            buildTextDisplay(
                '*If you find any bugs, please yell at <@292629679582609419> to fix them*',
            ),
        ],
    });
}
