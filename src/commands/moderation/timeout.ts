import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

// Duration conversion utilities
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout (mute) a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to timeout")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription("Timeout duration (1m, 1h, 1d, 1w)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for the timeout")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Check if the user has permission to timeout
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      ) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ You don't have permission to timeout members!",
              ),
          ],
        });
        return;
      }

      const targetUser = interaction.options.getUser("user");
      const durationString = interaction.options
        .getString("duration")
        ?.toLowerCase();
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      if (!targetUser || !durationString) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Please provide both a user and duration!"),
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

      // Parse duration string
      const parseDuration = (dur: string): number | null => {
        const match = dur.match(/^(\d+)([mhdw])$/);
        if (!match) return null;

        const [, amount, unit] = match;
        const value = parseInt(amount);

        switch (unit) {
          case "m":
            return value * MINUTE;
          case "h":
            return value * HOUR;
          case "d":
            return value * DAY;
          case "w":
            return value * WEEK;
          default:
            return null;
        }
      };

      const duration = parseDuration(durationString);

      if (!duration) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Invalid duration format! Use: 1m, 1h, 1d, or 1w",
              ),
          ],
        });
        return;
      }

      // Check if duration is within Discord's limits (max 28 days)
      if (duration > 28 * DAY) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Timeout duration cannot exceed 28 days!"),
          ],
        });
        return;
      }

      // Check if the target can be timed out
      if (!targetMember.moderatable) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ I cannot timeout this user! They may have higher permissions than me.",
              ),
          ],
        });
        return;
      }

      // Check if the user is trying to timeout themselves
      if (targetUser.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You cannot timeout yourself!"),
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
                "❌ You cannot timeout someone with an equal or higher role than you!",
              ),
          ],
        });
        return;
      }

      // Format the timeout reason
      const formattedReason = `Timeout by ${interaction.user.tag} (${interaction.user.id}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Try to DM the user before timeout
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("You've Been Timed Out")
          .setDescription(
            `You have been timed out in ${interaction.guild?.name}`,
          )
          .addFields(
            { name: "Duration", value: durationString },
            { name: "Reason", value: reason },
            { name: "Timed out By", value: interaction.user.tag },
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(`Could not DM timed out user ${targetUser.tag}`);
      }

      // Apply the timeout using the correct method
      await targetMember.timeout(duration, formattedReason);

      // Calculate when the timeout will end
      const timeoutEnd = new Date(Date.now() + duration);

      // Create success embed
      const timeoutEmbed = new EmbedBuilder()
        .setColor("#ffa500")
        .setTitle("⏰ User Timed Out")
        .setDescription(`Successfully timed out **${targetUser.tag}**`)
        .addFields(
          {
            name: "Timed Out User",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true,
          },
          {
            name: "Timed Out By",
            value: interaction.user.tag,
            inline: true,
          },
          {
            name: "Duration",
            value: durationString,
            inline: true,
          },
          {
            name: "Expires",
            value: `<t:${Math.floor(timeoutEnd.getTime() / 1000)}:R>`,
            inline: true,
          },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [timeoutEmbed] });
    } catch (error) {
      Logger.error("Timeout command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ An error occurred while trying to timeout the user.",
            ),
        ],
      });
    }
  },
};
