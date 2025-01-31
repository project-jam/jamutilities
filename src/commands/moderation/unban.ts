import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server")
    .addStringOption((option) =>
      option
        .setName("userid")
        .setDescription("The ID of the user to unban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for the unban")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Check if the user has permission to unban
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ You don't have permission to unban members!"),
          ],
        });
        return;
      }

      const userId = interaction.options.getString("userid");
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      if (!userId) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Please provide a valid user ID!"),
          ],
        });
        return;
      }

      // Check if the ID is valid
      if (!/^\d{17,19}$/.test(userId)) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Please provide a valid user ID! User IDs are 17-19 digit numbers.",
              ),
          ],
        });
        return;
      }

      // Fetch ban info to check if user is actually banned
      const banList = await interaction.guild?.bans.fetch();
      const banInfo = banList?.find((ban) => ban.user.id === userId);

      if (!banInfo) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ This user is not banned from this server!"),
          ],
        });
        return;
      }

      // Format the unban reason
      const formattedReason = `Unbanned by ${interaction.user.tag} (${interaction.user.id}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Perform the unban
      await interaction.guild?.members.unban(userId, formattedReason);

      // Create success embed
      const unbanEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("🔓 User Unbanned")
        .setDescription(`Successfully unbanned **${banInfo.user.tag}**`)
        .addFields(
          {
            name: "Unbanned User",
            value: `${banInfo.user.tag} (${banInfo.user.id})`,
            inline: true,
          },
          { name: "Unbanned By", value: interaction.user.tag, inline: true },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [unbanEmbed] });

      // Try to DM the unbanned user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("You've Been Unbanned")
          .setDescription(
            `You have been unbanned from ${interaction.guild?.name}`,
          )
          .addFields(
            { name: "Unbanned By", value: interaction.user.tag },
            { name: "Reason", value: reason },
          )
          .setTimestamp();

        await banInfo.user.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(`Could not DM unbanned user ${banInfo.user.tag}`);
      }
    } catch (error) {
      Logger.error("Unban command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ An error occurred while trying to unban the user.",
            ),
        ],
      });
    }
  },
};
