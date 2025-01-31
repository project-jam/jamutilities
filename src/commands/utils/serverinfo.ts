import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  GuildVerificationLevel,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getAverageColor } from "fast-average-color-node";

// Helper function to format timestamps
const formatDate = (date: Date): string => {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
};

// Helper function to get verification level string
const getVerificationLevel = (level: GuildVerificationLevel): string => {
  const levels: { [key in GuildVerificationLevel]: string } = {
    [GuildVerificationLevel.None]: "None",
    [GuildVerificationLevel.Low]: "Low",
    [GuildVerificationLevel.Medium]: "Medium",
    [GuildVerificationLevel.High]: "High",
    [GuildVerificationLevel.VeryHigh]: "Highest",
  };
  return levels[level];
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Shows detailed information about the server"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply(
          "This command can only be used in a server!",
        );
        return;
      }

      // Fetch more guild data
      await guild.fetch();

      // Get member counts
      const totalMembers = guild.memberCount;
      const botCount = guild.members.cache.filter(
        (member) => member.user.bot,
      ).size;
      const humanCount = totalMembers - botCount;

      // Try to fetch the owner with the logic you want
      let ownerInfo;
      try {
        const owner = await guild.fetchOwner();
        ownerInfo = `<@${owner.id}>`; // Just the mention if owner exists
      } catch {
        // If owner fetch fails, try to get from cache or fall back to ID with tag
        const cachedOwner = guild.members.cache.get(guild.ownerId);
        ownerInfo = cachedOwner
          ? `${cachedOwner.user.tag}`
          : `User left server (${guild.ownerId})`;
      }

      // Get dominant color from server icon
      let dominantColor = "#2b2d31"; // Default color
      if (guild.iconURL()) {
        try {
          const color = await getAverageColor(guild.iconURL({ size: 256 }));
          dominantColor = color.hex;
        } catch (error) {
          Logger.error("Failed to get average color:", error);
        }
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${guild.name} Server Information`)
        .setColor(dominantColor)
        .setThumbnail(guild.iconURL({ size: 1024 }) || "")
        .addFields(
          {
            name: "📑 General Information",
            value: [
              `**Name:** ${guild.name}`,
              `**ID:** ${guild.id}`,
              `**Owner:** ${ownerInfo}`,
              `**Created:** ${formatDate(guild.createdAt)}`,
              `**Verification Level:** ${getVerificationLevel(guild.verificationLevel)}`,
              guild.description
                ? `**Description:** ${guild.description}`
                : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
          {
            name: "👥 Member Stats",
            value: [`**Total Members:** ${totalMembers.toLocaleString()}`].join(
              "\n",
            ),
          },
          {
            name: "🎨 Server Features",
            value: guild.features.length
              ? guild.features
                  .map(
                    (feature) =>
                      `• ${feature
                        .split("_")
                        .map(
                          (word) =>
                            word.charAt(0).toUpperCase() +
                            word.slice(1).toLowerCase(),
                        )
                        .join(" ")}`,
                  )
                  .join("\n")
              : "No special features",
          },
        )
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add boost status if available
      if (guild.premiumSubscriptionCount) {
        embed.addFields({
          name: "✨ Boost Status",
          value: [
            `**Level:** ${guild.premiumTier}`,
            `**Boosts:** ${guild.premiumSubscriptionCount}`,
          ].join("\n"),
        });
      }

      // Add banner if available
      if (guild.bannerURL()) {
        embed.setImage(guild.bannerURL({ size: 1024 }) || "");
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Serverinfo command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Failed to fetch server information."),
        ],
      });
    }
  },
};
