import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to kick")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("The reason for the kick"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  prefix: {
    aliases: ["kick", "boot"],
    usage: "<@user> [reason]", // Example: jam!kick @user spamming
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let targetUser;
      let reason = "No reason provided";
      let guild;
      let executor;

      if (isPrefix) {
        const message = interaction as Message;
        guild = message.guild;
        executor = message.member;

        // Check permissions
        if (!message.member?.permissions.has(PermissionFlagsBits.KickMembers)) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ You don't have permission to kick members!",
                ),
            ],
          });
          return;
        }

        // Parse user mention and reason
        targetUser = message.mentions.users.first();
        if (!targetUser) {
          const prefix = process.env.PREFIX || "jam!";
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please mention a user to kick!")
                .addFields({
                  name: "Usage",
                  value: `${prefix}kick <@user> [reason]\nExample: ${prefix}kick @user spamming`,
                }),
            ],
          });
          return;
        }

        const args = message.content.split(/ +/).slice(1);
        if (args.length > 1) {
          reason = args.slice(1).join(" ");
        }
      } else {
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();
        guild = slashInteraction.guild;
        executor = slashInteraction.member;
        targetUser = slashInteraction.options.getUser("user");
        reason =
          slashInteraction.options.getString("reason") || "No reason provided";
      }

      if (!targetUser || !guild) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Please specify a valid user to kick!");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Get target member for hierarchy check
      const targetMember = await guild.members.fetch(targetUser.id);

      if (!targetMember) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Failed to fetch member information!");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Check if the target user is kickable
      if (!targetMember.kickable) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            "❌ I cannot kick this user! They may have higher permissions than me.",
          );

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Self-kick check
      if (
        targetUser.id ===
        (isPrefix
          ? (interaction as Message).author.id
          : (interaction as ChatInputCommandInteraction).user.id)
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ You cannot kick yourself!");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Role hierarchy check
      if (
        targetMember.roles.highest.position >=
        (executor as any).roles.highest.position
      ) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            "❌ You cannot kick someone with an equal or higher role than you!",
          );

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Try to DM the user before kicking
      try {
        const executorTag = isPrefix
          ? (interaction as Message).author.tag
          : (interaction as ChatInputCommandInteraction).user.tag;

        const dmEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setTitle("You've Been Kicked")
          .setDescription(`You have been kicked from ${guild.name}`)
          .addFields(
            { name: "Reason", value: reason },
            { name: "Kicked By", value: executorTag },
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(`Could not DM kicked user ${targetUser.tag}`);
      }

      // Format the kick reason
      const executorTag = isPrefix
        ? (interaction as Message).author.tag
        : (interaction as ChatInputCommandInteraction).user.tag;
      const executorId = isPrefix
        ? (interaction as Message).author.id
        : (interaction as ChatInputCommandInteraction).user.id;
      const formattedReason = `Kicked by ${executorTag} (${executorId}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Perform the kick
      await targetMember.kick(formattedReason);

      // Create success embed
      const kickEmbed = new EmbedBuilder()
        .setColor("#ffa500")
        .setTitle("👢 User Kicked")
        .setDescription(`Successfully kicked **${targetUser.tag}**`)
        .addFields(
          {
            name: "Kicked User",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true,
          },
          { name: "Kicked By", value: executorTag, inline: true },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [kickEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [kickEmbed],
        });
      }
    } catch (error) {
      Logger.error("Kick command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ An error occurred while trying to kick the user.");

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
