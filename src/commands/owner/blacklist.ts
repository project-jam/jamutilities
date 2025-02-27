import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/Command";
import { BlacklistManager } from "../../handlers/blacklistMembers";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Manage bot blacklist (Owner only)")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a user to the blacklist")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to blacklist")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Reason for blacklisting")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a user from the blacklist")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to unblacklist")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("search")
        .setDescription("Search the blacklist")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Search by ID, username, or reason")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("change")
        .setDescription("Change the reason for a blacklisted user")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user whose reason to change")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("new_reason")
            .setDescription("The new reason for the blacklist")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      await interaction.reply({
        content: "❌ This command is restricted to the bot owner only!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const blacklistManager = BlacklistManager.getInstance();
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "add": {
          const user = interaction.options.getUser("user")!;
          const reason = interaction.options.getString("reason")!;

          if (user.id === process.env.OWNER_ID) {
            await interaction.reply({
              content: "❌ You cannot blacklist the bot owner!",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await blacklistManager.addUser(user.id, user.tag, reason);

          const embed = new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("User Blacklisted")
            .setDescription(`Successfully blacklisted ${user.tag}`)
            .addFields(
              { name: "User ID", value: user.id },
              { name: "Username", value: user.tag },
              { name: "Reason", value: reason },
            )
            .setTimestamp();

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "remove": {
          const user = interaction.options.getUser("user")!;
          const removed = await blacklistManager.removeUser(user.id);

          const embed = new EmbedBuilder()
            .setColor(removed ? "#00ff00" : "#ff3838")
            .setTitle("Blacklist Remove")
            .setDescription(
              removed
                ? `Successfully removed ${user.tag} from the blacklist`
                : `${user.tag} was not found in the blacklist`,
            )
            .setTimestamp();

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "search": {
          const query = interaction.options.getString("query")!;
          const results = blacklistManager.searchBlacklist(query);

          if (results.length === 0) {
            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff3838")
                  .setTitle("No Results")
                  .setDescription(`No matches found for query: "${query}"`)
                  .addFields({
                    name: "Tip",
                    value:
                      "Try searching with:\n• User ID\n• Username\n• Reason for blacklist",
                  }),
              ],
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const embed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("🔍 Blacklist Search Results")
            .setDescription(
              `Found ${results.length} matching ${results.length === 1 ? "entry" : "entries"} for: "${query}"`,
            )
            .setTimestamp();

          results.forEach(([id, entry], index) => {
            embed.addFields({
              name: `Match ${index + 1}: ${entry.username}`,
              value: [
                `**ID:** \`${id}\``,
                `**Username:** ${entry.username}`,
                `**Reason:** ${entry.reason}`,
                `**Added:** <t:${Math.floor(entry.timestamp / 1000)}:R>`,
              ].join("\n"),
            });
          });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "change": {
          const user = interaction.options.getUser("user")!;
          const newReason = interaction.options.getString("new_reason")!;

          // Check if user is blacklisted
          const currentInfo = blacklistManager.getBlacklistInfo(user.id);
          if (!currentInfo) {
            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff3838")
                  .setDescription("❌ This user is not blacklisted!"),
              ],
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // Change the reason
          await blacklistManager.changeReason(user.id, newReason);

          const embed = new EmbedBuilder()
            .setColor("#00ff00")
            .setTitle("Blacklist Reason Updated")
            .setDescription(`Updated blacklist reason for ${user.tag}`)
            .addFields(
              { name: "User", value: user.tag },
              { name: "Old Reason", value: currentInfo.reason },
              { name: "New Reason", value: newReason },
            )
            .setTimestamp();

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      Logger.error("Blacklist command error:", error);
      await interaction.reply({
        content: "❌ An error occurred while managing the blacklist.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
