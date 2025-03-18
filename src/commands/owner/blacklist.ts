import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
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
    ),

  // Prefix aliases and usage for message commands
  prefix: {
    aliases: ["blacklist", "bl", "block"],
    usage:
      "blacklist <add/remove/search/change> <@user/ID> [reason/new_reason]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    // Owner check
    const userId = isPrefix
      ? (interaction as Message).author.id
      : (interaction as ChatInputCommandInteraction).user.id;

    if (userId !== process.env.OWNER_ID) {
      const response = {
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ This command is restricted to the bot owner only!",
            ),
        ],
      };

      if (isPrefix) {
        await (interaction as Message).reply(response);
      } else {
        await (interaction as ChatInputCommandInteraction).reply({
          ...response,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    const blacklistManager = BlacklistManager.getInstance();

    if (isPrefix) {
      // Prefix command handling
      const message = interaction as Message;
      const args = message.content.trim().split(/ +/).slice(1);
      const subCommand = args[0]?.toLowerCase();

      if (!subCommand) {
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Please specify a subcommand (add/remove/search/change)",
              )
              .addFields({
                name: "Usage",
                value: [
                  "```",
                  "jam!blacklist add @user <reason>",
                  "jam!bl remove @user",
                  "jam!blacklist search <query>",
                  "jam!bl change @user <new reason>",
                  "```",
                ].join("\n"),
              }),
          ],
        });
        return;
      }

      try {
        switch (subCommand) {
          case "add": {
            const user =
              message.mentions.users.first() ||
              (await message.client.users.fetch(args[1]).catch(() => null));
            const reason = args.slice(2).join(" ");

            if (!user || !reason) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Please provide a user and reason!")
                    .addFields({
                      name: "Usage",
                      value: "`jam!blacklist add @user <reason>`",
                    }),
                ],
              });
              return;
            }

            if (user.id === process.env.OWNER_ID) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ You cannot blacklist the bot owner!"),
                ],
              });
              return;
            }

            await blacklistManager.addUser(user.id, user.tag, reason);

            await message.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff3838")
                  .setTitle("User Blacklisted")
                  .setDescription(`Successfully blacklisted ${user.tag}`)
                  .addFields(
                    { name: "User ID", value: user.id },
                    { name: "Username", value: user.tag },
                    { name: "Reason", value: reason },
                  )
                  .setTimestamp(),
              ],
            });
            break;
          }

          case "remove": {
            const user =
              message.mentions.users.first() ||
              (await message.client.users.fetch(args[1]).catch(() => null));

            if (!user) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Please provide a valid user!")
                    .addFields({
                      name: "Usage",
                      value: "`jam!blacklist remove @user`",
                    }),
                ],
              });
              return;
            }

            const removed = await blacklistManager.removeUser(user.id);

            await message.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(removed ? "#00ff00" : "#ff3838")
                  .setTitle("Blacklist Remove")
                  .setDescription(
                    removed
                      ? `Successfully removed ${user.tag} from the blacklist`
                      : `${user.tag} was not found in the blacklist`,
                  )
                  .setTimestamp(),
              ],
            });
            break;
          }

          case "search": {
            const query = args.slice(1).join(" ");
            if (!query) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Please provide a search query!")
                    .addFields({
                      name: "Usage",
                      value: "`jam!blacklist search <query>`",
                    }),
                ],
              });
              return;
            }

            const results = blacklistManager.searchBlacklist(query);

            if (results.length === 0) {
              await message.reply({
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
              });
              return;
            }

            const embed = new EmbedBuilder()
              .setColor("#2b2d31")
              .setTitle("🔍 Blacklist Search Results")
              .setDescription(`Found ${results.length} matching entries`)
              .setTimestamp();

            results.forEach(([id, entry], index) => {
              embed.addFields({
                name: `Match ${index + 1}: ${entry.username}`,
                value: [
                  `**ID:** \`${id}\``,
                  `**Username:** ${entry.username}`,
                  `**Reason:** ${entry.reason}`,
                  `**Added:** <t:${entry.timestamp}:F>`,
                  `**Relative Time:** <t:${entry.timestamp}:R>`,
                ].join("\n"),
              });
            });

            await message.reply({ embeds: [embed] });
            break;
          }

          case "change": {
            const user =
              message.mentions.users.first() ||
              (await message.client.users.fetch(args[1]).catch(() => null));
            const newReason = args.slice(2).join(" ");

            if (!user || !newReason) {
              await message.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Please provide a user and new reason!")
                    .addFields({
                      name: "Usage",
                      value: "`jam!blacklist change @user <new reason>`",
                    }),
                ],
              });
              return;
            }

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

            await blacklistManager.changeReason(user.id, newReason);

            await message.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#00ff00")
                  .setTitle("Blacklist Reason Updated")
                  .setDescription(`Updated blacklist reason for ${user.tag}`)
                  .addFields(
                    { name: "User", value: user.tag },
                    { name: "Old Reason", value: currentInfo.reason },
                    { name: "New Reason", value: newReason },
                  )
                  .setTimestamp(),
              ],
            });
            break;
          }

          default:
            await message.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff3838")
                  .setDescription(
                    "❌ Invalid subcommand! Use: add, remove, search, or change",
                  )
                  .addFields({
                    name: "Available Subcommands",
                    value: [
                      "• `add` - Add a user to the blacklist",
                      "• `remove` - Remove a user from the blacklist",
                      "• `search` - Search the blacklist",
                      "• `change` - Change a user's blacklist reason",
                    ].join("\n"),
                  }),
              ],
            });
            break;
        }
      } catch (error) {
        Logger.error("Blacklist command error:", error);
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ An error occurred while managing the blacklist.",
              ),
          ],
        });
      }
    } else {
      // Slash command handling
      const slashInteraction = interaction as ChatInputCommandInteraction;
      const subcommand = slashInteraction.options.getSubcommand();

      try {
        switch (subcommand) {
          case "add": {
            const user = slashInteraction.options.getUser("user", true);
            const reason = slashInteraction.options.getString("reason", true);

            if (user.id === process.env.OWNER_ID) {
              await slashInteraction.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ You cannot blacklist the bot owner!"),
                ],
                flags: MessageFlags.Ephemeral,
              });
              return;
            }

            await blacklistManager.addUser(user.id, user.tag, reason);

            await slashInteraction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff3838")
                  .setTitle("User Blacklisted")
                  .setDescription(`Successfully blacklisted ${user.tag}`)
                  .addFields(
                    { name: "User ID", value: user.id },
                    { name: "Username", value: user.tag },
                    { name: "Reason", value: reason },
                  ),
              ],
            });
            break;
          }

          case "remove": {
            const user = slashInteraction.options.getUser("user", true);
            const removed = await blacklistManager.removeUser(user.id);

            await slashInteraction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(removed ? "#00ff00" : "#ff3838")
                  .setTitle("Blacklist Remove")
                  .setDescription(
                    removed
                      ? `Successfully removed ${user.tag} from the blacklist`
                      : `${user.tag} was not found in the blacklist`,
                  ),
              ],
            });
            break;
          }

          case "search": {
            const query = slashInteraction.options.getString("query", true);
            const results = blacklistManager.searchBlacklist(query);

            if (results.length === 0) {
              await slashInteraction.reply({
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
              .setDescription(`Found ${results.length} matching entries`)
              .setTimestamp();

            results.forEach(([id, entry], index) => {
              embed.addFields({
                name: `Match ${index + 1}: ${entry.username}`,
                value: [
                  `**ID:** \`${id}\``,
                  `**Username:** ${entry.username}`,
                  `**Reason:** ${entry.reason}`,
                  `**Added:** <t:${entry.timestamp}:F>`,
                  `**Relative Time:** <t:${entry.timestamp}:R>`,
                ].join("\n"),
              });
            });

            await slashInteraction.reply({ embeds: [embed] });
            break;
          }

          case "change": {
            const user = slashInteraction.options.getUser("user", true);
            const newReason = slashInteraction.options.getString(
              "new_reason",
              true,
            );

            const currentInfo = blacklistManager.getBlacklistInfo(user.id);
            if (!currentInfo) {
              await slashInteraction.reply({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ This user is not blacklisted!"),
                ],
                flags: MessageFlags.Ephemeral,
              });
              return;
            }

            await blacklistManager.changeReason(user.id, newReason);

            await slashInteraction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#00ff00")
                  .setTitle("Blacklist Reason Updated")
                  .setDescription(`Updated blacklist reason for ${user.tag}`)
                  .addFields(
                    { name: "User", value: user.tag },
                    { name: "Old Reason", value: currentInfo.reason },
                    { name: "New Reason", value: newReason },
                  )
                  .setTimestamp(),
              ],
            });
            break;
          }

          default:
            await slashInteraction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor("#ff3838")
                  .setDescription(
                    "❌ Invalid subcommand! Use: add, remove, search, or change",
                  )
                  .addFields({
                    name: "Available Subcommands",
                    value: [
                      "• `add` - Add a user to the blacklist",
                      "• `remove` - Remove a user from the blacklist",
                      "• `search` - Search the blacklist",
                      "• `change` - Change a user's blacklist reason",
                    ].join("\n"),
                  }),
              ],
              flags: MessageFlags.Ephemeral,
            });
            break;
        }
      } catch (error) {
        Logger.error("Blacklist command error:", error);
        await slashInteraction.reply({
          content: "❌ An error occurred while managing the blacklist.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
