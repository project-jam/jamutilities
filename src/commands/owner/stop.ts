import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";

async function cleanupFiles(): Promise<string[]> {
  const keptFiles = ["blacklist.env", ".env", "start.sh"];
  const preservedFiles: string[] = [];

  // Get the appropriate base path based on the platform
  const getBasePath = () => {
    // For pterodactyl containers
    if (process.env.CONTAINER_PATH) {
      return process.env.CONTAINER_PATH;
    }

    // For different operating systems
    switch (process.platform) {
      case "win32":
        return process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
      case "darwin":
        return join(homedir(), "Library", "Application Support");
      default: // linux and others
        return process.env.HOME || homedir();
    }
  };

  const basePath = getBasePath();

  try {
    async function removeContents(path: string) {
      const entries = await fs.readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(path, entry.name);

        // Skip protected directories
        if (entry.isDirectory()) {
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === ".github" ||
            entry.name === "jamutilities"
          ) {
            continue;
          }

          try {
            await removeContents(fullPath);
            await fs.rmdir(fullPath).catch((error) => {
              if (error.code !== "ENOTEMPTY") {
                Logger.error(`Failed to remove directory ${fullPath}:`, error);
              }
            });
          } catch (error) {
            Logger.error(`Error processing directory ${fullPath}:`, error);
          }
        } else {
          // Keep specified files
          if (keptFiles.includes(entry.name)) {
            preservedFiles.push(entry.name);
            continue;
          }

          try {
            await fs.unlink(fullPath).catch((error) => {
              Logger.error(`Failed to remove file ${fullPath}:`, error);
            });
          } catch (error) {
            Logger.error(`Error removing file ${fullPath}:`, error);
          }
        }
      }
    }

    await removeContents(basePath);
    return preservedFiles;
  } catch (error) {
    Logger.error("Error during cleanup:", error);
    throw error;
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Safely stops the bot and cleans up files (Owner only)")
    .setDMPermission(true)
    .addBooleanOption((option) =>
      option
        .setName("force")
        .setDescription("Force stop without graceful shutdown")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Check if the user is the bot owner
    if (interaction.user.id !== process.env.OWNER_ID) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ This command is restricted to the bot owner only!",
            ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const force = interaction.options.getBoolean("force") ?? false;

    // Create confirmation buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("stop_confirm")
        .setLabel("Yes, stop the bot")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🛑"),
      new ButtonBuilder()
        .setCustomId("stop_cancel")
        .setLabel("No, cancel")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✖️"),
    );

    // Send confirmation message with platform-specific info
    const platformInfo = `Platform: ${process.platform}\nBase Path: ${getBasePath()}`;

    // Send confirmation message
    const response = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff3838")
          .setTitle("⚠️ Confirm Bot Shutdown")
          .setDescription(
            "Are you sure you want to stop the bot? This will:\n\n" +
              "1️⃣ Disconnect the bot from Discord\n" +
              "2️⃣ Stop all processes\n" +
              "3️⃣ Remove bot-related files\n" +
              "4️⃣ Keep only: blacklist.env, .env, and start.sh\n\n" +
              `Shutdown Type: ${force ? "⚠️ Forced" : "🛑 Graceful"}\n\n` +
              `System Info:\n${platformInfo}`,
          ),
      ],
      components: [buttons],
    });

    const confirmMessage = await response.fetch();

    try {
      // Wait for button interaction
      const confirmation = await confirmMessage.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
        componentType: ComponentType.Button,
      });

      if (confirmation.customId === "stop_cancel") {
        await confirmation.update({
          embeds: [
            new EmbedBuilder()
              .setColor("#00ff00")
              .setDescription("✅ Bot shutdown cancelled."),
          ],
          components: [],
        });
        return;
      }

      await confirmation.update({ components: [] });

      if (force) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("⚠️ Force stopping the bot..."),
          ],
        });
        Logger.warn("Force stopping the bot...");
        process.exit(1);
      } else {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setTitle("🛑 Bot Shutdown Initiated")
              .setDescription("Stopping the bot and cleaning up files..."),
          ],
        });

        // Perform cleanup
        const preservedFiles = await cleanupFiles();

        // Send final message
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setTitle("✅ Shutdown Complete")
              .setDescription(
                "The following files have been preserved:\n" +
                  preservedFiles.map((file) => `• ${file}`).join("\n"),
              )
              .setFooter({ text: "Bot is shutting down..." }),
          ],
        });

        Logger.info(
          `Preserved files: ${preservedFiles.join(", ")}\nBot shutdown complete.`,
        );

        // Graceful shutdown
        await interaction.client.user?.setStatus("invisible");
        await interaction.client.destroy();
        process.exit(0);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("time")) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Shutdown confirmation timed out."),
          ],
          components: [],
        });
      } else {
        Logger.error("Error during shutdown:", error);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ An error occurred during shutdown."),
          ],
          components: [],
        });
      }
    }
  },
};

// Helper function to get base path (used in the confirmation message)
function getBasePath(): string {
  if (process.env.CONTAINER_PATH) {
    return process.env.CONTAINER_PATH;
  }

  switch (process.platform) {
    case "win32":
      return process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    case "darwin":
      return join(homedir(), "Library", "Application Support");
    default:
      return process.env.HOME || homedir();
  }
}
