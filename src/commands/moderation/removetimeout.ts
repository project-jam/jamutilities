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
    .setName("removetimeout")
    .setDescription("Remove a timeout from a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to remove timeout from")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for removing the timeout")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Check if the user has permission to manage timeouts
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      ) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ You don't have permission to remove timeouts!",
              ),
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
              .setDescription("❌ Please specify a valid user!"),
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

      // Check if the target is actually timed out
      if (!targetMember.isCommunicationDisabled()) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ This user is not timed out!"),
          ],
        });
        return;
      }

      // Check if the user is trying to remove their own timeout
      if (targetUser.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You cannot remove your own timeout!"),
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
                "❌ You cannot remove a timeout from someone with an equal or higher role than you!",
              ),
          ],
        });
        return;
      }

      // Format the removal reason
      const formattedReason = `Timeout removed by ${interaction.user.tag} (${interaction.user.id}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Try to DM the user about the timeout removal
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("Timeout Removed")
          .setDescription(
            `Your timeout in ${interaction.guild?.name} has been removed`,
          )
          .addFields(
            { name: "Removed By", value: interaction.user.tag },
            { name: "Reason", value: reason },
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(
          `Could not DM user ${targetUser.tag} about timeout removal`,
        );
      }

      // Remove the timeout
      await targetMember.timeout(null, formattedReason);

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("⏰ Timeout Removed")
        .setDescription(
          `Successfully removed timeout from **${targetUser.tag}**`,
        )
        .addFields(
          {
            name: "User",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true,
          },
          {
            name: "Removed By",
            value: interaction.user.tag,
            inline: true,
          },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      Logger.error("Remove timeout command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ An error occurred while trying to remove the timeout.",
            ),
        ],
      });
    }
  },
};
