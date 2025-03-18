import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getAverageColor } from "fast-average-color-node";

interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  createdAt: string;
  indexedAt: string;
  viewer?: {
    muted: boolean;
    blockedBy: boolean;
    following?: string;
    followedBy?: string;
  };
  labels?: Array<{
    src: string;
    uri: string;
    val: string;
    cts: string;
  }>;
}

interface BlueskyResolveResponse {
  did: string;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("bluesky")
    .setDescription("Get information about a Bluesky user")
    .addStringOption((option) =>
      option
        .setName("identifier")
        .setDescription(
          "Bluesky handle (@username.bsky.social) or DID (did:plc:...)",
        )
        .setRequired(true),
    ),

  prefix: {
    aliases: ["bluesky", "bsky"],
    usage: "<@handle.bsky.social/did:plc:...>", // Example: jam!bluesky @user.bsky.social
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    // Defer reply for slash command
    if (!isPrefix) {
      await (interaction as ChatInputCommandInteraction).deferReply();
    }

    try {
      // Get identifier from appropriate source
      let identifier: string;
      if (isPrefix) {
        const args = (interaction as Message).content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/g)
          .slice(1);

        if (args.length === 0) {
          await (interaction as Message).reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide a Bluesky handle or DID!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}bluesky <@handle.bsky.social/did:plc:...>`,
                    "Examples:",
                    "```",
                    `${process.env.PREFIX || "jam!"}bluesky @user.bsky.social`,
                    `${process.env.PREFIX || "jam!"}bluesky did:plc:abcdef123`,
                    "```",
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        identifier = args[0].trim();
        await (interaction as Message).channel.sendTyping();
      } else {
        identifier = (
          interaction as ChatInputCommandInteraction
        ).options.getString("identifier", true);
      }

      // Remove all "@" symbols if present
      identifier = identifier.replace(/@/g, "");

      // Validate: must be a DID or look like a handle
      if (!identifier.startsWith("did:plc:") && !identifier.includes(".")) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            "❌ Invalid identifier format. Please use either a handle (e.g., username.bsky.social) or DID (did:plc:...).",
          );

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // If it's a handle, resolve it to a DID using GET
      if (!identifier.startsWith("did:plc:")) {
        const resolveEndpoint =
          "https://api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=" +
          encodeURIComponent(identifier);
        const resolveResponse = await fetch(resolveEndpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Discord-Bot",
          },
        });

        if (!resolveResponse.ok) {
          if (resolveResponse.status === 404) {
            const notFoundEmbed = new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ User not found!");

            if (isPrefix) {
              await (interaction as Message).reply({ embeds: [notFoundEmbed] });
            } else {
              await (interaction as ChatInputCommandInteraction).editReply({
                embeds: [notFoundEmbed],
              });
            }
            return;
          }
          throw new Error(
            `Bluesky API (resolve) returned ${resolveResponse.status}`,
          );
        }
        const resolveData =
          (await resolveResponse.json()) as BlueskyResolveResponse;
        identifier = resolveData.did;
      }

      // Fetch profile data
      const profileEndpoint =
        "https://api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=" +
        encodeURIComponent(identifier);
      const response = await fetch(profileEndpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Discord-Bot",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          const notFoundEmbed = new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ User not found!");

          if (isPrefix) {
            await (interaction as Message).reply({ embeds: [notFoundEmbed] });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              embeds: [notFoundEmbed],
            });
          }
          return;
        }
        throw new Error(`Bluesky API (getProfile) returned ${response.status}`);
      }

      const data = (await response.json()) as BlueskyProfile;

      // Get dominant color
      let embedColor = "#0085ff"; // fallback color
      if (data.banner) {
        try {
          const color = await getAverageColor(data.banner);
          if (color && color.hex) {
            embedColor = color.hex;
          }
        } catch (colorError) {
          Logger.error(
            "Failed to compute average color from banner",
            colorError,
          );
        }
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(data.displayName || data.handle)
        .setURL(`https://bsky.app/profile/${data.handle}`)
        .setDescription(data.description || "No description provided")
        .addFields(
          {
            name: "📊 Statistics",
            value: [
              `📝 Posts: ${data.postsCount.toLocaleString()}`,
              `👥 Followers: ${data.followersCount.toLocaleString()}`,
              `👤 Following: ${data.followsCount.toLocaleString()}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🔍 Identity",
            value: [
              `🏷️ Handle: ${data.handle}`,
              `🆔 DID: ${data.did}`,
              `📅 Joined: <t:${Math.floor(new Date(data.createdAt).getTime() / 1000)}:R>`,
            ].join("\n"),
            inline: true,
          },
        )
        .setTimestamp();

      if (data.avatar) embed.setThumbnail(data.avatar);
      if (data.banner) embed.setImage(data.banner);

      if (data.labels && data.labels.length > 0) {
        embed.addFields({
          name: "🏷️ Labels",
          value: data.labels.map((label) => `\`${label.val}\``).join(", "),
          inline: false,
        });
      }

      if (data.viewer) {
        const relationshipInfo: string[] = [];
        if (data.viewer.following) relationshipInfo.push("✅ You follow them");
        if (data.viewer.followedBy) relationshipInfo.push("✅ They follow you");
        if (data.viewer.muted) relationshipInfo.push("🔇 Muted");
        if (data.viewer.blockedBy) relationshipInfo.push("🚫 They blocked you");

        if (relationshipInfo.length > 0) {
          embed.addFields({
            name: "👥 Relationship",
            value: relationshipInfo.join("\n"),
            inline: false,
          });
        }
      }

      // Send response
      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Bluesky command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Failed to fetch Bluesky profile information. Please try again later.",
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
