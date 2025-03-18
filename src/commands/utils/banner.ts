import {
  ChatInputCommandInteraction,
  Message,
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

  prefix: {
    aliases: ["banner", "userbanner"],
    usage: "[@user]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      // Handle different command types
      let user;
      if (interaction instanceof Message) {
        // Prefix command
        user = interaction.mentions.users.first() || interaction.author;
      } else {
        // Slash command
        await interaction.deferReply();
        user = interaction.options.getUser("user") || interaction.user;
      }

      // Fetch the full user to get banner information
      const fetchedUser = await user.fetch();
      const bannerUrl = fetchedUser.bannerURL({ size: 4096 });

      if (!bannerUrl) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(`❌ ${user.username} doesn't have a banner!`);

        if (interaction instanceof Message) {
          await interaction.reply({ embeds: [errorEmbed] });
        } else {
          await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
      }

      // Get the dominant color from the banner
      let color;
      try {
        color = await getAverageColor(bannerUrl);
      } catch {
        color = { hex: "#2b2d31" }; // Fallback color
      }

      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Banner`)
        .setImage(bannerUrl)
        .setColor(color.hex)
        .setTimestamp();

      // Send the response
      if (interaction instanceof Message) {
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ Something went wrong while fetching the banner!");

      if (interaction instanceof Message) {
        await interaction.reply({ embeds: [errorEmbed] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }
  },
};
