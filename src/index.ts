import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isCommand } from './utils.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { db } from './db/client.js';
import { eq } from 'drizzle-orm';
import { keyValue } from './db/schema.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

const instanceName = process.env.BOT_INSTANCE;
const instanceConfig = instanceName
    ? JSON.parse(
          fs.readFileSync(
              path.join(__dirname, `../instances/${instanceName}.json`),
              'utf-8',
          ),
      )
    : null;

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith('.ts'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        if (/[\/\\]handle/.test(filePath)) continue;
        const command = await import(pathToFileURL(filePath).href);
        if (isCommand(command)) {
            if (
                !instanceConfig ||
                instanceConfig.commands.includes('*') ||
                instanceConfig.commands.includes(command.data.name)
            ) {
                client.commands.set(command.data.name, command);
            }
        } else {
            console.warn(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
            );
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.ts'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(pathToFileURL(filePath).href);

    if (event.requiredIntents && instanceConfig) {
        const satisfied = event.requiredIntents.every((intent: string) =>
            instanceConfig.intents?.includes(intent),
        );
        if (!satisfied) continue;
    }

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

await client.login(process.env.DISCORD_TOKEN);

const statusKv = await db.query.keyValue.findFirst({
    where: eq(keyValue.key, 'status'),
});
if (statusKv)
    client.user?.setPresence({
        activities: [
            {
                name: statusKv.value,
            },
        ],
        status: 'online',
    });
