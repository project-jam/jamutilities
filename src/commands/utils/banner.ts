import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { getAverageColor } from "fast-average-color-node";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Shows user's banner")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user whose banner you want to see")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const user = interaction.options.getUser("user") || interaction.user;
    const fetchedUser = await user.fetch(true); // Force fetch to get banner
    const bannerUrl = fetchedUser.bannerURL({ size: 4096 });

    if (!bannerUrl) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(`❌ ${user.username} doesn't have a banner set!`),
        ],
      });
      return;
    }

    try {
      // Get the dominant color from the banner
      const color = await getAverageColor(bannerUrl);

      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Banner`)
        .setImage(bannerUrl)
        .setColor(color.hex)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      // Fallback to default color if color extraction fails
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Banner`)
        .setImage(bannerUrl)
        .setColor("#2b2d31")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
