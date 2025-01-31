import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Array of possible airkiss messages
const airkissMessages = [
  (user: string, target: string) => `**${user}** blows a kiss to **${target}**`,
  (user: string, target: string) =>
    `**${user}** sends flying kisses to **${target}**`,
  (user: string, target: string) =>
    `**${target}** catches an air kiss from **${user}**`,
  (user: string, target: string) =>
    `**${user}** sends their love through the air to **${target}**`,
  (user: string, target: string) =>
    `a wild air kiss appears from **${user}** to **${target}**`,
  (user: string, target: string) =>
    `**${user}** throws a kiss, hope **${target}** catches it!`,
  (user: string, target: string) =>
    `**${user}** sends virtual kisses to **${target}**`,
  (user: string, target: string) =>
    `look out **${target}**! An air kiss from **${user}** is coming your way!`,
  (user: string, target: string) =>
    `**${user}** sends their affection through the air to **${target}**`,
  (user: string, target: string) =>
    `**${target}** receives a long-distance kiss from **${user}**`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("airkiss")
    .setDescription("Blow a kiss to someone! 💋💨")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to send an air kiss to")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow air kissing yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Sending air kisses to yourself? That's just weird!",
              ),
          ],
        });
        return;
      }

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("airkiss"),
        Promise.resolve(
          getRandomMessage(
            airkissMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#ffb6c1") // Light pink for air kisses!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Airkiss command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Oops! Your air kiss got lost in the wind..."),
        ],
      });
    }
  },
};
