import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
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
        .setDescription('The command to toggle (e.g., "image search", "help")')
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("disable")
        .setDescription("Whether to disable or enable the command")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["toggle", "cmd", "command"],
    usage: '"<command>" <on/off/enable/disable>',
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    // Check owner permission
    const userId = isPrefix
      ? (interaction as Message).author.id
      : (interaction as ChatInputCommandInteraction).user.id;

    if (userId !== process.env.OWNER_ID) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ This command is restricted to the bot owner only!");

      if (isPrefix) {
        await (interaction as Message).channel.send({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }
      return;
    }

    let commandInput: string;
    let action: string | undefined;
    const prefix = process.env.PREFIX || "jam!";

    if (isPrefix) {
      // Handle prefix command parsing
      const message = interaction as Message;
      const args = message.content
        .slice(process.env.PREFIX?.length || 0)
        .trim()
        .split(/ +/g);

      if (args.length < 2) {
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Invalid usage!")
              .addFields({
                name: "Usage",
                value: [
                  `${prefix}toggle "<command>" <on/off/enable/disable>`,
                  "",
                  "Examples:",
                  `${prefix}toggle "image search" off`,
                  `${prefix}toggle "help" disable`,
                  "",
                  "Note: Commands with spaces must be wrapped in quotes",
                ].join("\n"),
              }),
          ],
        });
        return;
      }

      // Handle quoted command names
      if (args[1].startsWith('"')) {
        const quotedParts = [];
        let i = 1;
        while (i < args.length && !args[i].endsWith('"')) {
          quotedParts.push(args[i].replace(/^"/, ""));
          i++;
        }
        if (i < args.length) {
          quotedParts.push(args[i].replace(/"$/, ""));
          commandInput = quotedParts.join(" ");
          action = args[i + 1]?.toLowerCase();
        } else {
          commandInput = args[1].replace(/"/g, "");
          action = args[2]?.toLowerCase();
        }
      } else {
        commandInput = args[1];
        action = args[2]?.toLowerCase();
      }

      if (!action) {
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Please specify whether to enable or disable the command!",
              )
              .addFields({
                name: "Usage",
                value: `${prefix}toggle "<command>" <on/off/enable/disable>`,
              }),
          ],
        });
        return;
      }
    } else {
      commandInput = (
        interaction as ChatInputCommandInteraction
      ).options.getString("command", true);
      const disable = (
        interaction as ChatInputCommandInteraction
      ).options.getBoolean("disable", true);
      action = disable ? "off" : "on";
    }

    try {
      // Split input into command and subcommand
      const [mainCommand, ...subCommandParts] = commandInput.split(" ");
      const subCommand = subCommandParts.join(" ");

      const commandHandler = isPrefix
        ? (interaction as Message).client.commandHandler
        : (interaction as ChatInputCommandInteraction).client.commandHandler;

      const command = commandHandler.getCommands().get(mainCommand);

      if (!command) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(`❌ Command "${mainCommand}" does not exist.`);

        if (isPrefix) {
          await (interaction as Message).channel.send({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({
            embeds: [errorEmbed],
            ephemeral: true,
          });
        }
        return;
      }

      // If there's a subcommand, verify it exists
      if (
        subCommand &&
        !command.data.options?.some(
          (opt) => opt.toJSON().name === subCommand && opt.toJSON().type === 1,
        )
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `❌ Subcommand "${subCommand}" does not exist for command "${mainCommand}".`,
          );

        if (isPrefix) {
          await (interaction as Message).channel.send({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({
            embeds: [errorEmbed],
            ephemeral: true,
          });
        }
        return;
      }

      // Create the command string for storage
      const commandString = subCommand
        ? `${mainCommand} ${subCommand}`
        : mainCommand;

      const disable = action === "off" || action === "disable";

      await updateEnvFile(commandString, disable);
      commandHandler.toggleCommand(commandString, disable);

      const successEmbed = new EmbedBuilder()
        .setColor("#43b581")
        .setDescription(
          `✅ ${commandString} has been ${disable ? "disabled" : "enabled"} and saved to configuration.`,
        );

      if (isPrefix) {
        await (interaction as Message).channel.send({ embeds: [successEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({
          embeds: [successEmbed],
          ephemeral: true,
        });
      }
    } catch (error) {
      Logger.error("Failed to toggle command:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ Failed to ${action === "off" || action === "disable" ? "disable" : "enable"} command: ${error.message}`,
        );

      if (isPrefix) {
        await (interaction as Message).channel.send({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }
    }
  },
};
