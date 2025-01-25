import { Client, Collection, REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { Logger } from '../utils/logger';
import type { Command } from '../types/Command';

export class CommandHandler {
  private commands: Collection<string, Command> = new Collection();
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async loadCommands() {
    const commandsPath = join(__dirname, '..', 'commands');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const { command } = await import(filePath);
      
      if ('data' in command && 'execute' in command) {
        this.commands.set(command.data.name, command);
        Logger.info(`Loaded command: ${command.data.name}`);
      } else {
        Logger.warn(`Invalid command file: ${file}`);
      }
    }
  }

  async registerCommands() {
    try {
      const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
      const commandsData = Array.from(this.commands.values()).map(command => command.data.toJSON());

      Logger.info('Started refreshing application (/) commands.');

      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commandsData },
      );

      Logger.success('Successfully registered application commands.');
    } catch (error) {
      Logger.error('Error registering commands:', error);
    }
  }

  getCommands() {
    return this.commands;
  }
}
