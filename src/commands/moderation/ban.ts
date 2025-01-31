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
    .setName("ban")
    .setDescription("Ban a user from the server")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to ban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for the ban")
        .setRequired(false),
    )
    .addNumberOption((option) =>
      option
        .setName("days")
        .setDescription("Number of days of messages to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Check if the user has permission to ban
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You don't have permission to ban members!"),
          ],
        });
        return;
      }

      const targetUser = interaction.options.getUser("user");
      const reason =
        interaction.options.getString("reason") || "No reason provided";
      const deleteMessageDays = interaction.options.getNumber("days") || 0;

      if (!targetUser) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Please specify a valid user to ban!"),
          ],
        });
        return;
      }

      const targetMember = await interaction.guild?.members.fetch(
        targetUser.id,
      );

      // Check if the target user is bannable
      if (targetMember && !targetMember.bannable) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ I cannot ban this user! They may have higher permissions than me.",
              ),
          ],
        });
        return;
      }

      // Check if the user is trying to ban themselves
      if (targetUser.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You cannot ban yourself!"),
          ],
        });
        return;
      }

      // Check if the target user has a higher role
      if (
        targetMember &&
        interaction.member instanceof GuildMember &&
        targetMember.roles.highest.position >=
          interaction.member.roles.highest.position
      ) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ You cannot ban someone with an equal or higher role!",
              ),
          ],
        });
        return;
      }

      // Format the ban reason to include who banned and when
      const formattedReason = `Banned by ${interaction.user.tag} (${interaction.user.id}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Perform the ban with the formatted reason
      await interaction.guild?.members.ban(targetUser, {
        deleteMessageDays: deleteMessageDays,
        reason: formattedReason, // This will show up in Discord's ban list
      });

      // Create success embed
      const banEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("🔨 User Banned")
        .setDescription(`Successfully banned **${targetUser.tag}**`)
        .addFields(
          {
            name: "Banned User",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true,
          },
          { name: "Banned By", value: interaction.user.tag, inline: true },
          { name: "Reason", value: reason },
          {
            name: "Deleted Messages",
            value: `${deleteMessageDays} days`,
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [banEmbed] });

      // Try to DM the banned user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setTitle("You've Been Banned")
          .setDescription(
            `You have been banned from ${interaction.guild?.name}`,
          )
          .addFields(
            { name: "Reason", value: reason },
            { name: "Banned By", value: interaction.user.tag },
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(`Could not DM banned user ${targetUser.tag}`);
      }
    } catch (error) {
      Logger.error("Ban command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ An error occurred while trying to ban the user.",
            ),
        ],
      });
    }
  },
};
