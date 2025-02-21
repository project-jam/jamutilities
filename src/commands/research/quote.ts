import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface QuoteResponse {
  quote: string;
  author: string;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Get an inspirational quote")
    .setDMPermission(true),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const response = await fetch("https://quotes-api-self.vercel.app/quote");

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: QuoteResponse = await response.json();

      // Random colors for variety
      const colors = [
        "#FF6B6B", // Coral Red
        "#4ECDC4", // Turquoise
        "#45B7D1", // Sky Blue
        "#96CEB4", // Sage Green
        "#FFEEAD", // Cream Yellow
        "#D4A5A5", // Dusty Rose
        "#9B59B6", // Purple
        "#3498DB", // Blue
        "#E67E22", // Orange
        "#2ECC71", // Green
      ];

      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const embed = new EmbedBuilder()
        .setColor(randomColor)
        .setDescription(`> *"${data.quote}"*`)
        .setFooter({ text: `― ${data.author}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Quote command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Failed to fetch a quote. Try again later."),
        ],
      });
    }
  },
};
