import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  User,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getAverageColor } from "fast-average-color-node";

// Helper functions for date and time
const formatDate = (date: Date): string => {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
};

// Helper function to get user badges
const getUserBadges = (user: User, member?: GuildMember): string => {
  const badges = [];
  const flags = user.flags?.toArray();

  if (flags) {
    // Staff Badge
    if (flags.includes("Staff"))
      badges.push("<:discordstaff:1334862728636006495>");

    // Partner Badge
    if (flags.includes("Partner"))
      badges.push("<:discordpartner:1334862705613340702>");

    // Hypesquad Events Badge
    if (flags.includes("Hypesquad"))
      badges.push("<:hypesquadevents:1334862814233497612>");

    // Hypesquad House Badges
    if (flags.includes("HypeSquadOnlineHouse1"))
      badges.push("<:hypesquadbravery:1334862772663746621>");
    if (flags.includes("HypeSquadOnlineHouse2"))
      badges.push("<:hypesuqdbrilliance:1334862794176200725>");
    if (flags.includes("HypeSquadOnlineHouse3"))
      badges.push("<:hypesquadbalance:1334862747179159603>");

    // Bug Hunter Badges
    if (flags.includes("BugHunterLevel1"))
      badges.push("<:discordbughunter1:1334862636034031676>");
    if (flags.includes("BugHunterLevel2"))
      badges.push("<:discordbughunter2:1334862662122864640>");

    // Early Verified Bot Developer
    if (flags.includes("VerifiedDeveloper"))
      badges.push("<:discordbotdev:1334862623526752256>");

    // Early Supporter
    if (flags.includes("PremiumEarlySupporter"))
      badges.push("<:discordearlysupporter:1334862682343346188>");

    // Active Developer
    if (flags.includes("ActiveDeveloper"))
      badges.push("<:activedeveloper:1334862611354877992>");

    if (user.premiumType === 2)
      badges.push("<:boost15month:1334843946442031165>");

    // Server Boost Status
    if (member?.premiumSince) {
      const boostDate = member.premiumSince;
      const now = new Date();
      const boostDuration = Math.floor(
        (now.getTime() - boostDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      badges.push(
        `<:boost15month:1334843946442031165> (${boostDuration} days, since ${formatDate(
          boostDate,
        )})`,
      );
    }

    // Moderator Programs Badge
    if (flags.includes("CertifiedModerator"))
      badges.push("<:discordmod:1334871761598287913>");
  }

  return badges.length ? badges.join(" ") : "None";
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Shows information about a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to get info about (leave empty for self)")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("server_info")
        .setDescription("Show server-specific information")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const member = interaction.guild?.members.cache.get(targetUser.id);
      const showServerInfo =
        interaction.options.getBoolean("server_info") ?? true;

      // Fetch full user data
      const fetchedUser = await targetUser.fetch();
      const userBanner = fetchedUser.bannerURL({
        size: 4096,
        dynamic: true,
      });
      const bannerColor = fetchedUser.accentColor
        ? `#${fetchedUser.accentColor.toString(16)}`
        : null;

      // Get dominant color with proper hierarchy
      let dominantColor = "#2b2d31"; // Default color
      try {
        if (showServerInfo && member) {
          // Try server banner first
          const serverBanner = member.displayBannerURL({ size: 256 });
          if (serverBanner) {
            const color = await getAverageColor(serverBanner);
            dominantColor = color.hex;
          } else if (userBanner) {
            // Try global banner next
            const color = await getAverageColor(userBanner);
            dominantColor = color.hex;
          } else {
            // Fall back to avatar
            const avatarURL =
              member.avatarURL() || targetUser.displayAvatarURL({ size: 256 });
            const color = await getAverageColor(avatarURL);
            dominantColor = color.hex;
          }
        } else {
          // For global info, try global banner first
          if (userBanner) {
            const color = await getAverageColor(userBanner);
            dominantColor = color.hex;
          } else {
            // Fall back to global avatar
            const color = await getAverageColor(
              targetUser.displayAvatarURL({ size: 256 }),
            );
            dominantColor = color.hex;
          }
        }
      } catch (error) {
        Logger.error("Failed to get average color:", error);
      }

      // Get user badges
      const badges = getUserBadges(targetUser, member);

      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.tag}'s Information`)
        .setColor(dominantColor);

      // Handle avatar hierarchy for thumbnail
      if (showServerInfo && member) {
        // If showing server info, try server avatar first, then fall back to global
        if (member.avatarURL()) {
          embed.setThumbnail(
            member.avatarURL({ size: 4096, dynamic: true }) || "",
          );
        } else {
          embed.setThumbnail(
            targetUser.displayAvatarURL({ size: 4096, dynamic: true }),
          );
        }
      } else {
        // If not showing server info, just use global avatar
        embed.setThumbnail(
          targetUser.displayAvatarURL({ size: 4096, dynamic: true }),
        );
      }

      embed
        .addFields({
          name: "📑 User Information",
          value: [
            `**Username:** ${targetUser}`,
            `**Tag:** ${targetUser.tag}`,
            `**ID:** ${targetUser.id}`,
            `**Created:** ${formatDate(targetUser.createdAt)}`,
            `**Badges:** ${badges}`,
            bannerColor ? `**Banner Color:** ${bannerColor}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        })
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add server-specific information if requested and in a guild
      if (showServerInfo && member) {
        const roles = member.roles.cache
          .filter((role) => role.id !== interaction.guild?.id)
          .sort((a, b) => b.position - a.position)
          .map((role) => role.toString());

        const joinedAt = member.joinedAt
          ? formatDate(member.joinedAt)
          : "Unknown";

        embed.addFields({
          name: "🏷️ Server Member Info",
          value: [
            `**Joined Server:** ${joinedAt}`,
            `**Nickname:** ${member.nickname || "None"}`,
            `**Roles [${roles.length}]:** ${
              roles.length ? roles.join(", ") : "None"
            }`,
          ].join("\n"),
        });

        // Try to get server banner first
        const serverBanner = member.displayBannerURL({
          size: 4096,
          dynamic: true,
        });
        if (serverBanner) {
          embed.addFields({
            name: "🎨 Server Banner",
            value: `[Click here for banner link](${serverBanner})`,
          });
          embed.setImage(serverBanner);
        } else if (userBanner) {
          // Fall back to global banner if no server banner
          embed.addFields({
            name: "🎨 User Banner",
            value: `[Click here for banner link](${userBanner})`,
          });
          embed.setImage(userBanner);
        }
      } else if (userBanner) {
        // If not showing server info, just show global banner
        embed.addFields({
          name: "🎨 User Banner",
          value: `[Click here for banner link](${userBanner})`,
        });
        embed.setImage(userBanner);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Userinfo command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Failed to fetch user information."),
        ],
      });
    }
  },
};
