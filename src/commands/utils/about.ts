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
    aliases: ["avatar", "pfp", "profile"],
    usage: "[@user]",
  },

  async execute(interaction: ChatInputCommandInteraction | Message) {
    // First determine what type of interaction this is
    const isMessage = interaction instanceof Message;

    try {
      // Handle typing indicator for Message
      if (isMessage) {
        const message = interaction as Message;
        await message.channel.sendTyping();
      }

      // Get the target user
      let user;
      if (isMessage) {
        const message = interaction as Message;
        user = message.mentions.users.first() || message.author;
      } else {
        const slashCommand = interaction as ChatInputCommandInteraction;
        await slashCommand.deferReply();
        user = slashCommand.options.getUser("user") || slashCommand.user;
      }

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

      // Send the response based on interaction type
      if (isMessage) {
        const message = interaction as Message;
        await message.reply({ embeds: [embed] });
      } else {
        const slashCommand = interaction as ChatInputCommandInteraction;
        await slashCommand.editReply({ embeds: [embed] });
      }
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ Something went wrong while fetching the avatar!");

      if (isMessage) {
        const message = interaction as Message;
        await message.reply({ embeds: [errorEmbed] });
      } else {
        const slashCommand = interaction as ChatInputCommandInteraction;
        if (!slashCommand.deferred) {
          await slashCommand.reply({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await slashCommand.editReply({ embeds: [errorEmbed] });
        }
      }
    }
  },
};
