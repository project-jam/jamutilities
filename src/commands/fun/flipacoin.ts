import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("flip-a-coin")
    .setDescription("Flip a coin and get your result!"),

  async execute(interaction: ChatInputCommandInteraction) {
    // First, defer the reply so that the interaction is acknowledged
    await interaction.deferReply();

    // Randomly decide the coin flip result (Heads or Tails)
    const coinFlipResult = Math.random() < 0.5 ? "Heads" : "Tails";

    // Prepare the result message
    const resultMessage = `The coin landed on **${coinFlipResult}**! 🪙`;

    // Create the embed with the result
    const embed = new EmbedBuilder()
      .setTitle("Coin Flip Result!")
      .setDescription(resultMessage)
      .setColor(coinFlipResult === "Heads" ? "#2ecc71" : "#e74c3c") // Green for heads, red for tails
      .setTimestamp();

    // Send only the embed (no content)
    await interaction.editReply({ embeds: [embed] });
  },
};
