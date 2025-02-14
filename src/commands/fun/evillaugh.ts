import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

const evilMessages = [
  (user: string, target: string) =>
    `MUAHAHAHA! **${user}** has evil plans for **${target}**`,
  (user: string, target: string) =>
    `**${user}** laughs maniacally while looking at **${target}**`,
  (user: string, target: string) =>
    `**${user}** shows their evil side to **${target}**`,
  (user: string, target: string) =>
    `Watch out **${target}**! **${user}** has something planned...`,
  (user: string, target: string) =>
    `**${user}** channels their inner villain towards **${target}**`,
  (user: string, target: string) =>
    `**${target}** witnesses **${user}**'s evil laughter`,
  (user: string, target: string) =>
    `**${user}** unleashes their evil laugh at **${target}**`,
  (user: string, target: string) =>
    `An evil laugh echoes as **${user}** stares at **${target}**`,
  (user: string, target: string) =>
    `**${user}** plots something sinister for **${target}**`,
  (user: string, target: string) =>
    `A villainous laugh comes from **${user}** as they look at **${target}**`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("evil")
    .setDescription("Show your evil side! 😈")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("laugh")
        .setDescription("Evil laugh at someone! 😈")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to laugh at")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      const [gifUrl, message] = await Promise.all([
        getGif("evillaugh"),
        Promise.resolve(
          getRandomMessage(
            evilMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#800080") // Purple for evil vibes
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Evil laugh command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Your evil laugh turned into a cough... How embarrassing!",
            ),
        ],
      });
    }
  },
};
