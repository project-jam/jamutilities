import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dl")
    .setDescription("Share media from the last message or provided URL")
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("URL of the media to share (optional)")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      let mediaUrl = interaction.options.getString("url");

      // If no URL provided, search recent messages
      if (!mediaUrl) {
        const messages = await interaction.channel?.messages.fetch({
          limit: 10,
        });
        if (!messages) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Cannot read channel messages."),
            ],
          });
          return;
        }

        const sourceMessage = messages.find(
          (msg) =>
            msg.content.includes("tenor.com") ||
            msg.content.includes("giphy.com") ||
            msg.embeds.some((embed) => embed.video),
        );

        if (!sourceMessage) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ No recent message with media found."),
            ],
          });
          return;
        }

        // For videos in embeds, get the video URL
        if (sourceMessage.embeds.length > 0 && sourceMessage.embeds[0].video) {
          mediaUrl = sourceMessage.embeds[0].video.url;
        } else {
          // For Tenor/Giphy links
          mediaUrl = sourceMessage.content
            .split(" ")
            .find(
              (word) =>
                word.includes("tenor.com") || word.includes("giphy.com"),
            );
        }
      }

      if (!mediaUrl) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ No valid media found."),
          ],
        });
        return;
      }

      // Handle Tenor links
      if (mediaUrl.includes("tenor.com")) {
        await interaction.editReply(mediaUrl);
        return;
      }

      // For direct video URLs, send with special formatting for Discord's player
      await interaction.editReply(`<${mediaUrl}>`);
    } catch (error) {
      Logger.error("Share failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Failed to share the media."),
        ],
      });
    }
  },
};
