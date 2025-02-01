import { Client, Collection, REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { Logger } from "../utils/logger";
import type { Command } from "../types/Command";

export class CommandHandler {
  private commands: Collection<string, Command> = new Collection();
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async loadCommands() {
    const commandsPath = join(__dirname, "..", "commands");
    const commandFolders = readdirSync(commandsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    // Create a map to store commands by folder
    const commandsByFolder = new Map<string, string[]>();

    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter((file) =>
        file.endsWith(".ts"),
      );

      const loadedCommands: string[] = [];

      for (const file of commandFiles) {
        const filePath = join(folderPath, file);
        const { command } = await import(filePath);

        if ("data" in command && "execute" in command) {
          this.commands.set(command.data.name, command);
          loadedCommands.push(command.data.name);
        } else {
          Logger.warn(`Invalid command file: ${folder}/${file}`);
        }
      }

      if (loadedCommands.length > 0) {
        // Format the command list nicely
        const commandList = loadedCommands.join(", ");
        Logger.info(`Loaded command: ${commandList} (${folder})`);
      }
    }
  }

  async registerCommands() {
    try {
      const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
      const commandsData = Array.from(this.commands.values()).map((command) =>
        command.data.toJSON(),
      );

      Logger.info("Started refreshing application (/) commands.");

      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
        body: commandsData,
      });

      Logger.success("Successfully registered application commands.");
    } catch (error) {
      Logger.error("Error registering commands:", error);
    }
  }

  getCommands() {
    return this.commands;
  }
}
