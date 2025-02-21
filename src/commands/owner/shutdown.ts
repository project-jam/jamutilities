import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { promises as fs } from "fs";
import { join } from "path";

async function cleanupFiles(basePath: string): Promise<string[]> {
  const keptFiles = ["blacklist.env", ".env", "start.sh"];
  const preservedFiles: string[] = [];

  try {
    async function removeContents(path: string) {
      const entries = await fs.readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(path, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          await removeContents(fullPath);
          await fs.rmdir(fullPath);
        } else {
          if (keptFiles.includes(entry.name)) {
            preservedFiles.push(entry.name);
            continue;
          }
          await fs.unlink(fullPath);
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

    await interaction.deferReply();
    const force = interaction.options.getBoolean("force") ?? false;

    try {
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
        const preservedFiles = await cleanupFiles(process.cwd());

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

        process.exit(0);
      }
    } catch (error) {
      Logger.error("Error during shutdown:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ An error occurred during shutdown."),
        ],
      });
    }
  },
};
