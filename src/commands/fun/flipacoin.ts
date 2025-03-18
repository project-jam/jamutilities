import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("flip-a-coin")
    .setDMPermission(true)
    .setDescription("Flip a coin and get your result!"),

  prefix: {
    aliases: ["flip", "coin", "flipcoin", "flipacoin"],
    usage: "", // No arguments needed
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    if (!isPrefix) {
      await (interaction as ChatInputCommandInteraction).deferReply();
    } else {
      await (interaction as Message).channel.sendTyping();
    }

    try {
      // Randomly decide the coin flip result (Heads or Tails)
      const coinFlipResult = Math.random() < 0.5 ? "Heads" : "Tails";

      // Prepare the result message
      const resultMessage = `The coin landed on **${coinFlipResult}**! 🪙`;

      // Create the embed with the result
      const embed = new EmbedBuilder()
        .setTitle("Coin Flip Result!")
        .setDescription(resultMessage)
        .setColor(coinFlipResult === "Heads" ? "#2ecc71" : "#e74c3c") // Green for heads, red for tails
        .setFooter({
          text: `Flipped by ${
            isPrefix
              ? (interaction as Message).author.tag
              : (interaction as ChatInputCommandInteraction).user.tag
          }`,
          iconURL: isPrefix
            ? (interaction as Message).author.displayAvatarURL()
            : (
                interaction as ChatInputCommandInteraction
              ).user.displayAvatarURL(),
        })
        .setTimestamp();

      // Send the embed
      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ The coin fell and rolled away! Try again!");

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
