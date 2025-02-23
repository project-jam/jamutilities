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
      process.env.DISABLED_COMMANDS?.toLowerCase().split(",").filter(Boolean) ||
        [],
    );
  }

  async loadCommands() {
    const commandsPath = join(__dirname, "..", "commands");
    const commandFolders = readdirSync(commandsPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter((file) =>
        file.endsWith(".ts"),
      );

      for (const file of commandFiles) {
        const filePath = join(folderPath, file);
        try {
          const { command } = await import(filePath);

          if ("data" in command && "execute" in command) {
            this.commands.set(command.data.name, command);

            if (this.isCommandDisabled(command.data.name)) {
              Logger.warn(`Loaded disabled command: ${command.data.name}`);
            } else {
              Logger.info(`Loaded command: ${command.data.name}`);
            }
          }
        } catch (error) {
          Logger.error(`Error loading command ${file}:`, error);
        }
      }
    }
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
      if (this.isCommandDisabled(interaction.commandName)) {
        if (interaction.user.id === process.env.OWNER_ID) {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content:
                "⚠️ Note: This command is currently disabled for regular users.",
              flags: MessageFlags.Ephemeral,
            });
          }
          await command.execute(interaction);
        } else {
          const embed = new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("⚠️ Command Disabled")
            .setDescription("This command is currently disabled.")
            .addFields({
              name: "Why?",
              value:
                "This command may be under maintenance or temporarily restricted.",
            })
            .setFooter({
              text: "Please try again later or contact the bot owner for more information.",
            })
            .setTimestamp();

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              embeds: [embed],
              flags: MessageFlags.Ephemeral,
            });
          }
        }
        return;
      }

      await command.execute(interaction);
      Logger.command(
        `${interaction.user.tag} used /${interaction.commandName} in ${interaction.guild?.name || "DM"}`,
      );
    } catch (error) {
      Logger.error(
        `Command execution failed: ${interaction.commandName}`,
        error,
      );

      try {
        const errorMessage =
          "❌ There was an error while executing this command!";

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: errorMessage,
            flags: MessageFlags.Ephemeral,
          });
        } else if (interaction.deferred) {
          await interaction.editReply({ content: errorMessage });
        }
      } catch (followUpError) {
        Logger.error("Error sending error message:", followUpError);
      }
    }
  }

  public toggleCommand(commandName: string, disable: boolean) {
    const normalizedName = commandName.toLowerCase();
    if (disable) {
      this.disabledCommands.add(normalizedName);
      Logger.info(`Command "${commandName}" has been disabled.`);
    } else {
      this.disabledCommands.delete(normalizedName);
      Logger.info(`Command "${commandName}" has been enabled.`);
    }
  }

  public isCommandDisabled(commandName: string): boolean {
    return this.disabledCommands.has(commandName.toLowerCase());
  }

  getCommands() {
    return this.commands;
  }
}
