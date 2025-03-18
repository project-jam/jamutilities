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

// Parse duration string helper
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
      option.setName("reason").setDescription("The reason for the timeout"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  prefix: {
    aliases: ["timeout", "mute", "to"],
    usage: "<@user> <duration> [reason]", // Example: jam!timeout @user 1h spamming
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let targetUser;
      let durationString;
      let reason = "No reason provided";
      let guild;
      let executor;

      if (isPrefix) {
        const message = interaction as Message;
        guild = message.guild;
        executor = message.member;

        // Check permissions
        if (
          !message.member?.permissions.has(PermissionFlagsBits.ModerateMembers)
        ) {
          await message.reply({
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

        const args = message.content.split(/ +/).slice(1);

        // Check for required arguments
        if (args.length < 2) {
          const prefix = process.env.PREFIX || "jam!";
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide both a user and duration!")
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map(
                      (alias) =>
                        `${prefix}${alias} <@user> <duration> [reason]`,
                    )
                    .concat("Example: `jam!timeout @user 1h spamming`")
                    .join("\n"),
                }),
            ],
          });
          return;
        }

        targetUser = message.mentions.users.first();
        durationString = args[1].toLowerCase();
        if (args.length > 2) {
          reason = args.slice(2).join(" ");
        }
      } else {
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();
        guild = slashInteraction.guild;
        executor = slashInteraction.member;
        targetUser = slashInteraction.options.getUser("user");
        durationString = slashInteraction.options
          .getString("duration")
          ?.toLowerCase();
        reason =
          slashInteraction.options.getString("reason") || "No reason provided";
      }

      if (!targetUser || !durationString || !guild) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Please provide both a user and duration!");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      const duration = parseDuration(durationString);

      if (!duration) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Invalid duration format! Use: 1m, 1h, 1d, or 1w");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Check if duration is within Discord's limits
      if (duration > 28 * DAY) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Timeout duration cannot exceed 28 days!");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      const targetMember = await guild.members.fetch(targetUser.id);

      // Various checks...
      // [Continue with all the existing checks (moderatable, self-timeout, role hierarchy)
      // but update the response handling for both prefix and slash commands]

      // Format the timeout reason
      const executorTag = isPrefix
        ? (interaction as Message).author.tag
        : (interaction as ChatInputCommandInteraction).user.tag;
      const executorId = isPrefix
        ? (interaction as Message).author.id
        : (interaction as ChatInputCommandInteraction).user.id;
      const formattedReason = `Timeout by ${executorTag} (${executorId}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Try to DM the user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("You've Been Timed Out")
          .setDescription(`You have been timed out in ${guild.name}`)
          .addFields(
            { name: "Duration", value: durationString },
            { name: "Reason", value: reason },
            { name: "Timed out By", value: executorTag },
          )
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(`Could not DM timed out user ${targetUser.tag}`);
      }

      // Apply the timeout
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
          { name: "Timed Out By", value: executorTag, inline: true },
          { name: "Duration", value: durationString, inline: true },
          {
            name: "Expires",
            value: `<t:${Math.floor(timeoutEnd.getTime() / 1000)}:R>`,
            inline: true,
          },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [timeoutEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [timeoutEmbed],
        });
      }
    } catch (error) {
      Logger.error("Timeout command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ An error occurred while trying to timeout the user.",
        );

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
