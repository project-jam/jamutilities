import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

const deviousMessages = [
  (user: string, target: string) =>
    `**${user}** has devious plans for **${target}**`,
  (user: string, target: string) =>
    `**${user}** grins deviously at **${target}**`,
  (user: string, target: string) =>
    `Hehehe... **${user}** schemes something for **${target}**`,
  (user: string, target: string) =>
    `**${user}** can't help but laugh at their plans for **${target}**`,
  (user: string, target: string) =>
    `**${target}** should be worried about **${user}**'s devious laugh`,
  (user: string, target: string) =>
    `**${user}** has something planned for **${target}**... hehehe`,
  (user: string, target: string) =>
    `A devious plan forms as **${user}** looks at **${target}**`,
  (user: string, target: string) =>
    `**${user}** laughs mischievously while eyeing **${target}**`,
  (user: string, target: string) =>
    `Oh no! **${user}** has that look while staring at **${target}**`,
  (user: string, target: string) =>
    `**${target}** notices **${user}**'s suspicious laughter`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("devious")
    .setDescription("Laugh deviously at someone! 😈")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to be devious towards")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("evillaugh"),
        Promise.resolve(
          getRandomMessage(
            deviousMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#4B0082") // Indigo for devious vibes
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Devious command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Your devious plan failed... Back to the drawing board!",
            ),
        ],
      });
    }
  },
};
