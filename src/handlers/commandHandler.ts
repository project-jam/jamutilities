import {
  Client,
  Collection,
  REST,
  Routes,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { Logger } from "../utils/logger";
import type { Command } from "../types/Command";

export class CommandHandler {
  private commands: Collection<string, Command> = new Collection();
  private client: Client;
  private disabledCommands: Set<string>;

  constructor(client: Client) {
    this.client = client;
    this.disabledCommands = new Set(
      process.env.DISABLED_COMMANDS?.split(",")
        .map((cmd) => cmd.trim())
        .filter((cmd) => cmd.length > 0)
        .map((cmd) => cmd.toLowerCase()) || [],
    );
  }

  async loadCommands() {
    const commandsPath = join(__dirname, "..", "commands");
    const commandFolders = readdirSync(commandsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const categoryCommands = new Map<string, string[]>();
    let totalLoaded = 0;

    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter((file) =>
        file.endsWith(".ts"),
      );

      const loadedCommands: string[] = [];

      for (const file of commandFiles) {
        const filePath = join(folderPath, file);
        try {
          const { command } = await import(filePath);

          if ("data" in command && "execute" in command) {
            this.commands.set(command.data.name, command);
            loadedCommands.push(command.data.name);
            totalLoaded++;
          }
        } catch (error) {
          Logger.error(`Error loading command ${file}:`, error);
        }
      }

      if (loadedCommands.length > 0) {
        categoryCommands.set(folder, loadedCommands);
      }
    }

    Logger.info("Loaded commands:");
    for (const [category, commands] of categoryCommands) {
      const commandList = commands
        .map((cmd) => {
          // Check both main command and subcommands
          const isDisabled = Array.from(this.disabledCommands).some(
            (disabled) => disabled.startsWith(cmd.toLowerCase()),
          );
          if (isDisabled) {
            return `${cmd} (disabled)`;
          }
          return cmd;
        })
        .join(", ");

      Logger.info(`${commandList} (${category})`);
    }

    const totalDisabled = this.disabledCommands.size;
    Logger.success(
      `\nTotal: ${totalLoaded} commands loaded (${totalDisabled} disabled)\n`,
    );
  }

  async registerCommands() {
    try {
      const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
      const commandsData = Array.from(this.commands.values()).map((command) =>
        command.data.toJSON(),
      );

      Logger.info(`Started refreshing application (/) commands.`);

      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
        body: commandsData,
      });

      Logger.success("Successfully registered application commands.");
    } catch (error) {
      Logger.error("Error registering commands:", error);
      throw error;
    }
  }

  async handleCommand(interaction: ChatInputCommandInteraction) {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    try {
      // Check if either the main command or the specific subcommand is disabled
      const commandString = interaction.options.getSubcommand(false)
        ? `${interaction.commandName} ${interaction.options.getSubcommand()}`
        : interaction.commandName;

      if (this.isCommandDisabled(commandString)) {
        if (interaction.user.id === process.env.OWNER_ID) {
          // For owner, just execute without warning
          await command.execute(interaction);
        } else {
          // For regular users, show disabled message
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("This command is currently disabled."),
            ],
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      await command.execute(interaction);
      Logger.command(
        `${interaction.user.tag} used /${commandString} in ${interaction.guild?.name || "DM"}`,
      );
    } catch (error) {
      Logger.error(
        `Command execution failed: ${interaction.commandName}`,
        error,
      );

      try {
        const errorMessage = {
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ An error occurred while executing this command.",
              ),
          ],
          flags: MessageFlags.Ephemeral,
        };

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(errorMessage);
        } else if (interaction.deferred) {
          await interaction.editReply(errorMessage);
        }
      } catch (followUpError) {
        Logger.error("Error sending error message:", followUpError);
      }
    }
  }

  public toggleCommand(commandString: string, disable: boolean) {
    const normalizedCommand = commandString.toLowerCase();
    if (disable) {
      this.disabledCommands.add(normalizedCommand);
      Logger.info(`Command "${commandString}" has been disabled.`);
    } else {
      this.disabledCommands.delete(normalizedCommand);
      Logger.info(`Command "${commandString}" has been enabled.`);
    }
  }

  public isCommandDisabled(commandString: string): boolean {
    return this.disabledCommands.has(commandString.toLowerCase());
  }

  getCommands() {
    return this.commands;
  }

  getDisabledCommands() {
    return Array.from(this.disabledCommands);
  }
}
