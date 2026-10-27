import {
  type ChatInputCommandInteraction,
  Collection,
  SlashCommandBuilder,
} from "discord.js";

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
  }
}

interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
