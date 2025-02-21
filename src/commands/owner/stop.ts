import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
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

    const confirmEmbed = new EmbedBuilder()
      .setColor("#ff3838")
      .setTitle("⚠️ Confirm Bot Shutdown and Cleanup")
      .setDescription(
        "Are you sure you want to stop the bot? This will:\n\n" +
          "1️⃣ Disconnect the bot from Discord\n" +
          "2️⃣ Stop all processes\n" +
          "3️⃣ Remove bot-related files\n" +
          "4️⃣ Preserve configuration files\n\n" +
          "The following files will be kept:\n" +
          "• blacklist.env\n" +
          "• .env\n" +
          "• start.sh\n" +
          "• Configuration files (package.json, etc.)\n\n" +
          `Shutdown Type: ${force ? "⚠️ Forced" : "🛑 Graceful"}`,
      )
      .setFooter({
        text: "This action cannot be undone!",
        iconURL: interaction.client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("stop_confirm")
        .setLabel("Yes, stop and clean")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🛑"),
      new ButtonBuilder()
        .setCustomId("stop_cancel")
        .setLabel("No, cancel")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✖️"),
    );

    const confirmMessage = await interaction.reply({
      embeds: [confirmEmbed],
      components: [buttons],
      fetchReply: true,
    });

    try {
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
              .setDescription("✅ Bot shutdown and cleanup cancelled.")
              .setTimestamp(),
          ],
          components: [],
        });
        return;
      }

      // Start cleanup process
      await confirmation.update({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("🚧 Cleanup and Shutdown in Progress")
            .setDescription("Cleaning up files and preparing for shutdown...")
            .setTimestamp(),
        ],
        components: [],
      });

      // Perform file cleanup
      const preservedFiles = await cleanupFiles(process.cwd());

      const farewells = [
        "Goodbye, cruel world! 👋",
        "I'll be back... 🤖",
        "Time for a nap... 😴",
        "Shutting down systems... 🔌",
        "See you space cowboy... 🚀",
        "Hasta la vista, baby! 🕶️",
        "Power level critical... shutting down... 🪫",
        "Memory purge in progress... 💾",
        "Alt + F4 pressed... ⌨️",
        "rm -rf /* (just kidding!) 💀",
      ];

      const finalEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("🛑 Bot Shutdown Complete")
        .setDescription(
          "Bot has been stopped and files have been cleaned up.\n\n" +
            "**Preserved Files:**\n" +
            preservedFiles.map((file) => `• ${file}`).join("\n"),
        )
        .addFields(
          {
            name: "Initiated By",
            value: interaction.user.tag,
            inline: true,
          },
          {
            name: "Shutdown Type",
            value: force ? "Forced" : "Graceful",
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.followUp({
        embeds: [finalEmbed],
        content: farewells[Math.floor(Math.random() * farewells.length)],
      });

      Logger.warn(
        `Bot shutdown and cleanup initiated by ${interaction.user.tag} (${force ? "forced" : "graceful"})`,
      );

      if (!force) {
        Logger.info("Performing graceful shutdown...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await interaction.client.user?.setStatus("invisible");
        await interaction.client.destroy();
        Logger.info("Bot has been gracefully shut down");
      } else {
        Logger.warn("Performing force shutdown!");
        await interaction.client.destroy();
      }

      process.exit(force ? 1 : 0);
    } catch (error) {
      if (error instanceof Error && error.message.includes("time")) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Shutdown confirmation timed out.")
              .setTimestamp(),
          ],
          components: [],
        });
      } else {
        Logger.error("Error during shutdown:", error);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ An error occurred while trying to stop the bot and clean up files.",
              ),
          ],
          components: [],
        });
      }
    }
  },
};
