import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { getAverageColor } from "fast-average-color-node";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pfp")
    .setDescription("Shows user's profile picture")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user whose profile picture you want to see")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply(); // Defer the reply since we'll be fetching color

    const user = interaction.options.getUser("user") || interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 4096 });

    try {
      // Get the dominant color from the avatar
      const color = await getAverageColor(avatarUrl);

      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Profile Picture`)
        .setImage(avatarUrl)
        .setColor(color.hex)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      // Fallback to default color if color extraction fails
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Profile Picture`)
        .setImage(avatarUrl)
        .setColor("#2b2d31")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
