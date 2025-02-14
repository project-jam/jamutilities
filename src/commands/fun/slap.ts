import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

const slapMessages = [
  (user: string, target: string) => `**${user}** slaps **${target}**!`,
  (user: string, target: string) =>
    `**${user}** gives **${target}** a hard slap!`,
  (user: string, target: string) =>
    `**${user}** smacks **${target}** across the face!`,
  (user: string, target: string) =>
    `**${user}** teaches **${target}** a lesson with a slap!`,
  (user: string, target: string) =>
    `Watch out **${target}**! **${user}** just slapped you!`,
  (user: string, target: string) =>
    `**${user}** delivers a mighty slap to **${target}**!`,
  (user: string, target: string) =>
    `Ouch! **${user}** slaps **${target}** without mercy!`,
  (user: string, target: string) =>
    `**${user}** gives **${target}** a wake-up slap!`,
  (user: string, target: string) =>
    `**${target}** receives a stinging slap from **${user}**!`,
  (user: string, target: string) =>
    `**${user}** slaps some sense into **${target}**!`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slap")
    .setDMPermission(true)
    .setDescription("Slap someone! 👋")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The user to slap")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("target");

      // Check if target is the ignored user ID from environment variables
      if (target?.id === process.env.IGNORED_USER_ID) {
        await interaction.editReply("ignore her");
        return;
      }

      const [gifUrl, message] = await Promise.all([
        getGif("slap"),
        Promise.resolve(
          getRandomMessage(
            slapMessages,
            interaction.user.toString(),
            target?.toString() || "someone",
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#FF4444") // Red for slapping!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Slap command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Couldn't slap that person... Maybe they dodged?",
            ),
        ],
      });
    }
  },
};
