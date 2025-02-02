import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Array of possible pat messages
const patMessages = [
  (user: string, target: string) =>
    `**${user}** gently pats **${target}**'s head`,
  (user: string, target: string) =>
    `**${user}** gives **${target}** a comforting pat`,
  (user: string, target: string) => `**${user}** pats **${target}** lovingly`,
  (user: string, target: string) =>
    `**${target}** receives headpats from **${user}**`,
  (user: string, target: string) =>
    `**${user}** shows affection by patting **${target}**`,
  (user: string, target: string) =>
    `**${user}** couldn't resist patting **${target}**`,
  (user: string, target: string) =>
    `**${target}** enjoys being patted by **${user}**`,
  (user: string, target: string) =>
    `aww, **${user}** pats **${target}** softly`,
  (user: string, target: string) =>
    `**${user}** gives **${target}** encouraging headpats`,
  (user: string, target: string) =>
    `**${target}** gets showered with pats from **${user}**`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pat")
    .setDescription("Pat someone's head! 🤗")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to pat")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow patting yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Need headpats? Let someone else pat you instead!",
              ),
          ],
        });
        return;
      }

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("pat"),
        Promise.resolve(
          getRandomMessage(
            patMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1") // Light pink for wholesome pats!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Pat command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Couldn't give those headpats... Maybe next time!",
            ),
        ],
      });
    }
  },
};
