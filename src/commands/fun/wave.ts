import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Array of possible wave messages
const waveMessages = [
  (user: string, target: string) =>
    `**${user}** waves happily at **${target}**`,
  (user: string, target: string) =>
    `**${user}** sends a friendly wave to **${target}**`,
  (user: string, target: string) =>
    `**${user}** greets **${target}** with a cheerful wave`,
  (user: string, target: string) =>
    `**${user}** waves enthusiastically at **${target}**`,
  (user: string, target: string) =>
    `hey **${target}**! **${user}** is waving at you!`,
  (user: string, target: string) =>
    `**${user}** says hello to **${target}** with a wave`,
  (user: string, target: string) =>
    `**${target}** catches **${user}**'s friendly wave`,
  (user: string, target: string) =>
    `**${user}** waves their hand excitedly at **${target}**`,
  (user: string, target: string) =>
    `**${user}** sends warm greetings to **${target}**`,
  (user: string, target: string) =>
    `**${target}** receives a wholesome wave from **${user}**`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("wave")
    .setDescription("Wave at someone! 👋")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to wave at")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow waving at yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Waving at yourself? That's a bit lonely, isn't it?",
              ),
          ],
        });
        return;
      }

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("wave"),
        Promise.resolve(
          getRandomMessage(
            waveMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#87CEEB") // Sky blue for friendly waves!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Greet command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Oops! Your wave didn't make it through..."),
        ],
      });
    }
  },
};
