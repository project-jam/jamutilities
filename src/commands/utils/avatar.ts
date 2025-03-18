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
    .setName("avatar")
    .setDescription("Shows user's profile picture")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user whose profile picture you want to see")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["avatar", "profile"],
    usage: "[@user]",
  },

  async execute(interaction: ChatInputCommandInteraction | Message) {
    try {
      // Determine what type of interaction this is
      if (interaction instanceof Message) {
        // Handle prefix command (Message)
        const message = interaction;
        await message.channel.sendTyping();

        // Get the target user
        const user = message.mentions.users.first() || message.author;
        const avatarUrl = user.displayAvatarURL({ size: 4096 });

        // Get the dominant color from the avatar
        let color;
        try {
          color = await getAverageColor(avatarUrl);
        } catch {
          color = { hex: "#2b2d31" }; // Fallback color
        }

        const embed = new EmbedBuilder()
          .setTitle(`${user.username}'s Profile Picture`)
          .setImage(avatarUrl)
          .setColor(color.hex)
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        // Handle slash command
        const slashCommand = interaction as ChatInputCommandInteraction;
        await slashCommand.deferReply();

        // Get the target user
        const user = slashCommand.options.getUser("user") || slashCommand.user;
        const avatarUrl = user.displayAvatarURL({ size: 4096 });

        // Get the dominant color from the avatar
        let color;
        try {
          color = await getAverageColor(avatarUrl);
        } catch {
          color = { hex: "#2b2d31" }; // Fallback color
        }

        const embed = new EmbedBuilder()
          .setTitle(`${user.username}'s Profile Picture`)
          .setImage(avatarUrl)
          .setColor(color.hex)
          .setTimestamp();

        await slashCommand.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in pfp command:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ Something went wrong while fetching the avatar!");

      if (interaction instanceof Message) {
        await interaction.reply({ embeds: [errorEmbed] });
      } else {
        const slashCommand = interaction as ChatInputCommandInteraction;
        if (slashCommand.deferred) {
          await slashCommand.editReply({ embeds: [errorEmbed] });
        } else {
          await slashCommand.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      }
    }
  },
};
