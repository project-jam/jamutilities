import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/Command";
import { promises as fs } from "fs";
import { Logger } from "../../utils/logger";
import { join } from "path";

async function updateEnvFile(commandString: string, disable: boolean) {
  const envPath = join(process.cwd(), ".env");
  try {
    let envContent = await fs.readFile(envPath, "utf-8");

    // Get current disabled commands
    const match = envContent.match(/DISABLED_COMMANDS=(.+)(\r?\n|$)/);
    let disabledCommands = match
      ? new Set(match[1].split(",").map((cmd) => cmd.trim()))
      : new Set<string>();

    if (disable) {
      disabledCommands.add(commandString);
    } else {
      disabledCommands.delete(commandString);
    }

    const newDisabledCommands = Array.from(disabledCommands)
      .filter((cmd) => cmd) // Remove empty entries
      .join(",");

    if (match) {
      envContent = envContent.replace(
        /DISABLED_COMMANDS=.+(\r?\n|$)/,
        `DISABLED_COMMANDS=${newDisabledCommands}$1`,
      );
    } else {
      envContent += `\nDISABLED_COMMANDS=${newDisabledCommands}`;
    }

    await fs.writeFile(envPath, envContent);
    process.env.DISABLED_COMMANDS = newDisabledCommands;
  } catch (error) {
    Logger.error("Failed to update .env file:", error);
    throw error;
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("toggle")
    .setDescription("Toggle commands on/off (Owner only)")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command to toggle (e.g., 'image search', 'help')")
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("disable")
        .setDescription("Whether to disable or enable the command")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      await interaction.reply({
        content: "This command is only available to the bot owner.",
        ephemeral: true,
      });
      return;
    }

    const commandInput = interaction.options
      .getString("command", true)
      .toLowerCase();
    const disable = interaction.options.getBoolean("disable", true);

    // Split input into command and subcommand
    const [mainCommand, ...subCommandParts] = commandInput.split(" ");
    const subCommand = subCommandParts.join(" ");

    const commandHandler = interaction.client.commandHandler;
    const command = commandHandler.getCommands().get(mainCommand);

    if (!command) {
      await interaction.reply({
        content: `Command "${mainCommand}" does not exist.`,
        ephemeral: true,
      });
      return;
    }

    // If there's a subcommand, verify it exists
    if (
      subCommand &&
      !command.data.options?.some(
        (opt) => opt.toJSON().name === subCommand && opt.toJSON().type === 1,
      )
    ) {
      await interaction.reply({
        content: `Subcommand "${subCommand}" does not exist for command "${mainCommand}".`,
        ephemeral: true,
      });
      return;
    }

    // Create the command string for storage (command + subcommand)
    const commandString = subCommand
      ? `${mainCommand} ${subCommand}`
      : mainCommand;

    try {
      await updateEnvFile(commandString, disable);
      commandHandler.toggleCommand(commandString, disable);

      await interaction.reply({
        content: `${commandString} has been ${disable ? "disabled" : "enabled"} and saved to configuration.`,
        ephemeral: true,
      });
    } catch (error) {
      Logger.error(`Failed to toggle command:`, error);
      await interaction.reply({
        content: `Failed to ${disable ? "disable" : "enable"} command: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
