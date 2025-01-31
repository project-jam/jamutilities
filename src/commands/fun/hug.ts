import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Array of possible hug messages
const hugMessages = [
  (user: string, target: string) =>
    `aww, **${user}** gives **${target}** a warm hug`,
  (user: string, target: string) =>
    `**${user}** wraps their arms around **${target}**`,
  (user: string, target: string) =>
    `**${user}** pulls **${target}** in for a big hug`,
  (user: string, target: string) =>
    `**${target}** receives a comforting hug from **${user}**`,
  (user: string, target: string) =>
    `**${user}** couldn't help but hug **${target}**`,
  (user: string, target: string) =>
    `look how sweet! **${user}** hugs **${target}**`,
  (user: string, target: string) =>
    `**${user}** spreads the love by hugging **${target}**`,
  (user: string, target: string) =>
    `**${target}** gets squeezed in a tight hug by **${user}**`,
  (user: string, target: string) =>
    `**${user}** shares a tender moment hugging **${target}**`,
  (user: string, target: string) => `**${user}** embraces **${target}** warmly`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("Give someone a warm hug! 🤗")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to hug")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow hugging yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Need a hug? Try hugging someone else instead!",
              ),
          ],
        });
        return;
      }

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("hug"),
        Promise.resolve(
          getRandomMessage(
            hugMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#ffd1dc") // Light pink for wholesome hugs!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Hug command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Couldn't send that hug... Maybe next time!"),
        ],
      });
    }
  },
};
