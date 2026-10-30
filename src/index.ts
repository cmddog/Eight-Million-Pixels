import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isCommand } from './utils.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith('.ts'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = await import(pathToFileURL(filePath).href);
        if (isCommand(command)) {
            client.commands.set(command.data.name, command);
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
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

void client.login(process.env.DISCORD_TOKEN);
