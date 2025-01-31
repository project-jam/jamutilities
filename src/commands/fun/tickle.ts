import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Array of possible tickle messages
const tickleMessages = [
  (user: string, target: string) =>
    `aww, **${user}** gives **${target}** a tick- WHAT ARE YOU DOING?!`,
  (user: string, target: string) =>
    `**${user}** tickles **${target}** and runs away giggling`,
  (user: string, target: string) =>
    `**${user}** tickles **${target}** and makes them laugh`,
  (user: string, target: string) =>
    `**${user}** tickles **${target}** and makes them squ- STOP!!!!!!`,
  (user: string, target: string) =>
    `**${user}** tickles **${target}**, making them laugh uncontrollably`,
  (user: string, target: string) =>
    `**${user}** tickles **${target}**, with a mischievous grin`,
  (user: string, target: string) =>
    `**${user}** tickles **${target}**, making them squirm and MADNESS!`,
  (user: string, target: string) =>
    `oh my god, **${user}** tickles **${target}** and they can't stop laughing`,
  (user: string, target: string) =>
    `**${user}** shares a tickle with **${target}** and they both laugh`,
  (user: string, target: string) => `**${user}** tickles **${target}**!`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tickle")
    .setDescription("Tickle someone? (you better not be ticklish!)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to tickle")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow tickling yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Need a tickle? Try tickling someone else instead! Otherwise, you might get stuck in a loop...",
              ),
          ],
        });
        return;
      }

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("tickle"),
        Promise.resolve(
          getRandomMessage(
            tickleMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#ffd1dc") // Light pink for wholesome tickles!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Tickle command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Couldn't send that tickle... Maybe next time! じゃね, またね!"),
        ],
      });
    }
  },
};

