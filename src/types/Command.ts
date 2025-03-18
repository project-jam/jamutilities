import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  Message,
} from "discord.js";

export interface Command {
  // Slash command data
  data: SlashCommandBuilder;

  // Prefix command configuration
  prefix: {
    aliases: string[]; // Alternative command names
    usage: string; // Usage example
  };

  // Execute method that handles both interaction types
  execute: (
    interaction: ChatInputCommandInteraction | Message,
    isPrefix?: boolean,
  ) => Promise<void>;

  // Optional cooldown in seconds
  cooldown?: number;
}
