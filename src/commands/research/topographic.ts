import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("topographic")
    .setDescription("Generate a topographic lines image")
    .addNumberOption((option) =>
      option
        .setName("width")
        .setDescription("Width of the image (100-3840)")
        .setMinValue(100)
        .setMaxValue(3840)
        .setRequired(false),
    )
    .addNumberOption((option) =>
      option
        .setName("height")
        .setDescription("Height of the image (100-2160)")
        .setMinValue(100)
        .setMaxValue(2160)
        .setRequired(false),
    )
    .addNumberOption((option) =>
      option
        .setName("thickness")
        .setDescription("Thickness of the lines (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("linecolor")
        .setDescription("Line color in hex (e.g., FFFFFF for white)")
        .setRequired(false)
        .setMinLength(6)
        .setMaxLength(6),
    )
    .addStringOption((option) =>
      option
        .setName("bgcolor")
        .setDescription("Background color in hex (e.g., 000000 for black)")
        .setRequired(false)
        .setMinLength(6)
        .setMaxLength(6),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Get options with defaults
      const width = interaction.options.getNumber("width") || 1920;
      const height = interaction.options.getNumber("height") || 1080;
      const thickness = interaction.options.getNumber("thickness") || 3;
      const lineColor = interaction.options.getString("linecolor") || "FFFFFF";
      const bgColor = interaction.options.getString("bgcolor") || "000000";

      // Validate hex colors
      const hexColorRegex = /^[0-9A-Fa-f]{6}$/;
      if (!hexColorRegex.test(lineColor) || !hexColorRegex.test(bgColor)) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Invalid hex color format. Use format like 'FFFFFF' for white.",
              ),
          ],
        });
        return;
      }

      // Construct API URL
      const apiUrl = `https://api.project-jam.is-a.dev/api/v0/topographic-lines?width=${width}&height=${height}&thickness=${thickness}&lineColor=${lineColor}&bgColor=${bgColor}`;

      // Fetch the image
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      // Convert to buffer
      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "topographic.png",
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(`#${lineColor}`)
        .setTitle("🗺️ Topographic Lines Generated")
        .addFields(
          {
            name: "Dimensions",
            value: `${width}x${height}`,
            inline: true,
          },
          {
            name: "Line Thickness",
            value: thickness.toString(),
            inline: true,
          },
          {
            name: "Colors",
            value: `Lines: #${lineColor}\nBackground: #${bgColor}`,
            inline: true,
          },
        )
        .setImage("attachment://topographic.png")
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      Logger.error("Topographic command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to generate topographic lines. Please try again later.",
            ),
        ],
      });
    }
  },
};
