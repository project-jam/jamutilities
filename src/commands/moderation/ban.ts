import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  Message,
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
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  prefix: {
    aliases: ["blacklist"],
    usage:
      "blacklist <add/remove/search/change> <@user/ID> [reason/new_reason]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    const blacklistManager = BlacklistManager.getInstance();

    let subcommand: string;
    let userId: string;
    let reason: string;
    let newReason: string;
    let executor;

    try {
      if (isPrefix) {
        // Prefix-based execution
        const message = interaction as Message;
        executor = message.author;

        if (executor.id !== process.env.OWNER_ID) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ This command is restricted to the bot owner only!",
                ),
            ],
          });
          return;
        }

        const args = message.content.split(/ +/).slice(1);
        subcommand = args[0];
        userId = message.mentions.users.first()?.id || args[1] || undefined!;
        reason = args.slice(2).join(" ");

        switch (subcommand) {
          case "add": {
            if (!userId || !reason) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(
                      "❌ Please provide a user and a reason to blacklist!",
                    ),
                ],
              });
              return;
            }

            if (userId === process.env.OWNER_ID) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ You cannot blacklist the bot owner!"),
                ],
              });
              return;
            }

            const user = await message.client.users.fetch(userId);

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

            await message.reply({ embeds: [embed] });
            break;
          }

          case "remove": {
            if (!userId) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Please provide a user to unblacklist!"),
                ],
              });
              return;
            }

            const user = await message.client.users.fetch(userId);
            const removed = await blacklistManager.removeUser(user.id);

            const embed = new EmbedBuilder()
              .setColor(removed ? "#00ff00" : "#ff3838")
              .setTitle("Blacklist Remove")
              .setDescription(
                removed
                  ? `✅ Successfully removed ${user.tag} from the blacklist`
                  : `❌ ${user.tag} was not found in the blacklist`,
              )
              .setTimestamp();

            await message.reply({ embeds: [embed] });
            break;
          }

          case "search": {
            if (!reason) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Please provide a query!"),
                ],
              });
              return;
            }

            const results = blacklistManager.searchBlacklist(reason);

            if (results.length === 0) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setTitle("No Results")
                    .setDescription(`No matches found for query: "${reason}"`)
                    .addFields({
                      name: "Tip",
                      value:
                        "Try searching with:\n• User ID\n• Username\n• Reason for blacklist",
                    }),
                ],
              });
              return;
            }

            const embed = new EmbedBuilder()
              .setColor("#2b2d31")
              .setTitle("🔍 Blacklist Search Results")
              .setDescription(`Found ${results.length} matching entries:`);

            results.forEach(([id, entry], index) => {
              embed.addFields({
                name: `Match ${index + 1}: ${entry.username}`,
                value: [
                  `**ID:** \`${id}\``,
                  `**Username:** ${entry.username}`,
                  `**Reason:** ${entry.reason}`,
                  `**Added:** <t:${entry.timestamp}:F>`,
                ].join("\n"),
              });
            });

            await message.reply({ embeds: [embed] });
            break;
          }

          case "change": {
            if (!userId || !reason) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(
                      "❌ Please provide a user and a new reason!",
                    ),
                ],
              });
              return;
            }

            const user = await message.client.users.fetch(userId);
            const currentInfo = blacklistManager.getBlacklistInfo(user.id);

            if (!currentInfo) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ This user is not blacklisted!"),
                ],
              });
              return;
            }

            await blacklistManager.changeReason(user.id, reason);

            const embed = new EmbedBuilder()
              .setColor("#00ff00")
              .setTitle("Blacklist Reason Updated")
              .setDescription(`Updated blacklist reason for ${user.tag}`)
              .setTimestamp();

            await message.reply({ embeds: [embed] });
            break;
          }
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
