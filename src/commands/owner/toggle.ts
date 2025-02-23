import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("toggle")
    .setDescription("Toggle commands on/off (Owner only)")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command to toggle")
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

    const commandName = interaction.options.getString("command", true);
    const disable = interaction.options.getBoolean("disable", true);

    // Access command handler through client
    const commandHandler = interaction.client.commandHandler;

    if (!commandHandler.getCommands().has(commandName)) {
      await interaction.reply({
        content: `Command "${commandName}" does not exist.`,
        ephemeral: true,
      });
      return;
    }

    try {
      commandHandler.toggleCommand(commandName, disable);
      await interaction.reply({
        content: `Command "${commandName}" has been ${disable ? "disabled" : "enabled"}.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `Failed to ${disable ? "disable" : "enable"} command: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
