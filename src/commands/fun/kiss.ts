import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Array of possible kiss messages
const kissMessages = [
  (user: string, target: string) => `ooh, **${user}** kisses **${target}**`,
  (user: string, target: string) =>
    `**${user}** plants a sweet kiss on **${target}**`,
  (user: string, target: string) =>
    `**${user}** couldn't resist kissing **${target}**`,
  (user: string, target: string) =>
    `aww, **${user}** gives **${target}** a loving kiss`,
  (user: string, target: string) => `**${user}** smooches **${target}**`,
  (user: string, target: string) =>
    `**${target}** receives a surprise kiss from **${user}**`,
  (user: string, target: string) =>
    `**${user}** steals a kiss from **${target}**`,
  (user: string, target: string) =>
    `look at that! **${user}** kissed **${target}**`,
  (user: string, target: string) =>
    `how cute! **${user}** gives **${target}** a kiss`,
  (user: string, target: string) =>
    `**${user}** shows their affection by kissing **${target}**`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kiss")
    .setDescription("Kiss someone! 💋")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to kiss")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow kissing yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You can't kiss yourself! You dumbsh*t!"),
          ],
        });
        return;
      }

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("kiss"),
        Promise.resolve(
          getRandomMessage(
            kissMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#ff69b4")
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Kiss command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Failed to send the kiss... How embarrassing!"),
        ],
      });
    }
  },
};
