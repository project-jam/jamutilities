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
      option
        .setName("reason")
        .setDescription("The reason for the kick")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Check if the user has permission to kick
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)
      ) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You don't have permission to kick members!"),
          ],
        });
        return;
      }

      const targetUser = interaction.options.getUser("user");
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      if (!targetUser) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Please specify a valid user to kick!"),
          ],
        });
        return;
      }

      // Get both members for hierarchy check
      const targetMember = await interaction.guild?.members.fetch(
        targetUser.id,
      );
      const executorMember = await interaction.guild?.members.fetch(
        interaction.user.id,
      );

      if (!targetMember || !executorMember) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Failed to fetch member information!"),
          ],
        });
        return;
      }

      // Check if the target user is kickable by the bot
      if (!targetMember.kickable) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ I cannot kick this user! They may have higher permissions than me.",
              ),
          ],
        });
        return;
      }

      // Check if the user is trying to kick themselves
      if (targetUser.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You cannot kick yourself!"),
          ],
        });
        return;
      }

      // Check role hierarchy
      if (
        targetMember.roles.highest.position >=
        executorMember.roles.highest.position
      ) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ You cannot kick someone with an equal or higher role than you!",
              ),
          ],
        });
        return;
      }

      // Format the kick reason
      const formattedReason = `Kicked by ${interaction.user.tag} (${interaction.user.id}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Try to DM the user before kicking
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setTitle("You've Been Kicked")
          .setDescription(
            `You have been kicked from ${interaction.guild?.name}`,
          )
          .addFields(
            { name: "Reason", value: reason },
            { name: "Kicked By", value: interaction.user.tag },
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(`Could not DM kicked user ${targetUser.tag}`);
      }

      // Perform the kick
      await targetMember.kick(formattedReason);

      // Create success embed
      const kickEmbed = new EmbedBuilder()
        .setColor("#ffa500") // Orange color for kicks
        .setTitle("👢 User Kicked")
        .setDescription(`Successfully kicked **${targetUser.tag}**`)
        .addFields(
          {
            name: "Kicked User",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true,
          },
          { name: "Kicked By", value: interaction.user.tag, inline: true },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [kickEmbed] });
    } catch (error) {
      Logger.error("Kick command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ An error occurred while trying to kick the user.",
            ),
        ],
      });
    }
  },
};
