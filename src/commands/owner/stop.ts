import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Safely stops the bot (Owner only)")
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

    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setColor("#ff3838")
      .setTitle("⚠️ Confirm Bot Shutdown")
      .setDescription(
        force
          ? "Are you sure you want to force stop the bot? This will immediately disconnect the bot from Discord and terminate all processes without cleanup."
          : "Are you sure you want to stop the bot? This will disconnect the bot from Discord and stop all processes gracefully.",
      )
      .addFields({
        name: "Shutdown Type",
        value: force ? "⚠️ Forced Shutdown" : "🛑 Graceful Shutdown",
        inline: true,
      })
      .setFooter({
        text: "This action cannot be undone!",
        iconURL: interaction.client.user?.displayAvatarURL(),
      })
      .setTimestamp();

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

    // Send confirmation message with buttons
    const confirmMessage = await interaction.reply({
      embeds: [confirmEmbed],
      components: [buttons],
      fetchReply: true,
    });

    try {
      // Wait for button interaction
      const confirmation = await confirmMessage.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
        componentType: ComponentType.Button,
      });

      if (confirmation.customId === "stop_cancel") {
        // User cancelled the shutdown
        const cancelEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setDescription("✅ Bot shutdown cancelled.")
          .setTimestamp();

        await confirmation.update({
          embeds: [cancelEmbed],
          components: [],
        });
        return;
      }

      // User confirmed the shutdown
      const stopEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("🛑 Bot Shutdown Initiated")
        .setDescription(
          force
            ? "⚠️ Force stopping the bot..."
            : "💤 Gracefully shutting down the bot...",
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

      // Random farewell messages
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

      await confirmation.update({
        embeds: [stopEmbed],
        components: [],
        content: farewells[Math.floor(Math.random() * farewells.length)],
      });

      // Log the shutdown
      Logger.warn(
        `Bot shutdown initiated by ${interaction.user.tag} (${
          force ? "forced" : "graceful"
        })`,
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
        // Timeout occurred
        const timeoutEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Shutdown confirmation timed out.")
          .setTimestamp();

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [],
        });
      } else {
        Logger.error("Error during shutdown:", error);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ An error occurred while trying to stop the bot.",
              ),
          ],
          components: [],
        });
      }
    }
  },
};
