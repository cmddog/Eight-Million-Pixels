import { REST, Routes } from 'discord.js';
import type { RESTPutAPIApplicationGuildCommandsResult } from 'discord-api-types/v10';
import { isCommand } from './src/utils.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import * as fs from 'node:fs';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.APP_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error('Required environment variables not defined.');
    process.exit(1);
}

const commands = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const foldersPath = path.join(__dirname, 'src/commands');
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
            commands.push(command.data.toJSON());
        } else {
            console.log(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
            );
        }
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(
            `Started refreshing ${commands.length} application (/) commands.`,
        );

        const data = (await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        )) as RESTPutAPIApplicationGuildCommandsResult;

        console.log(
            `Successfully reloaded ${data.length} application (/) commands for ${clientId}.`,
        );
    } catch (error) {
        console.log(error);
    }
})();
