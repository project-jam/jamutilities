// Shutdpwn the bot
// This command will shutdown the bot. If the bot is running in production, it will perform a graceful shutdown. If the bot is running in development, it will perform a force shutdown.
import { SlashCommandBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { promises as fs } from "fs";
import { join } from "path";

async function cleanupFiles(basePath: string): Promise<string[]> {
  const keptFiles = ["blacklist.env", ".env", "start.sh"];

  const preservedFiles: string[] = [];

  try {
    // Recursively remove all files and directories except those in keptFiles
    async function removeContents(path: string) {
      const entries = await fs.readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(path, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and .git directories
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          await removeContents(fullPath);
          await fs.rmdir(fullPath);
        } else {
          // Check if file should be kept
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
    await interaction.deferReply();

    const force = interaction.options.getBoolean("force") ?? false;

    if (force) {
      Logger.warn("Force stopping the bot...");
      process.exit(1);
    } else {
      Logger.warn("Stopping the bot...");
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("🛑 Stopping the bot..."),
        ],
      });

      // Perform cleanup
      const preservedFiles = await cleanupFiles(__dirname);

      Logger.info(
        "Preserved files:",
        preservedFiles,
        "\nand yeah, the bot's turned off, so you can turn it back on now if needed.",
      );

      process.exit(0);
    }
  },
};
