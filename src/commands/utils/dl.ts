import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import axios from "axios";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import {
  callJambaltApi,
  type JambaltApiResponse,
} from "../../utils/jambaltApi";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dl")
    .setDescription("Generates a download link")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("The URL of the media to download (required)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("videoquality")
        .setDescription("Video quality (e.g., 720, 1080, max)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("audioformat")
        .setDescription("Audio format (mp3, ogg, wav, opus, best)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("audiobitrate")
        .setDescription("Audio bitrate (e.g., 128, 256, 320)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("filenamestyle")
        .setDescription("Filename style (classic, pretty, basic, nerdy)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("downloadmode")
        .setDescription("Download mode (auto, audio, mute)")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("alwaysproxy")
        .setDescription("Always tunnel download through proxy")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("disablemetadata")
        .setDescription("Disable file metadata (e.g., Artist, MP3 Info)")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("tiktokfullaudio")
        .setDescription("Download original TikTok audio (Only for TikTok)")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("tiktokh265")
        .setDescription("Allow H265 videos for TikTok/Xiaohongshu")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("twitterbskygif")
        .setDescription("Convert Twitter/Bluesky GIFs to .gif format")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("linkonly")
        .setDescription(
          "Always send download link only, do not attach the file",
        )
        .setRequired(false),
    ),

  prefix: {
    aliases: ["dl", "download"],
    usage: "<url> [options]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    let mediaUrl: string;
    let apiOptions: Record<string, any> = {};
    let linkOnlyFlag = false;

    if (isPrefix) {
      const args = (interaction as Message).content.split(" ");
      mediaUrl = args[1]; // First argument after command

      if (!mediaUrl) {
        const prefix = process.env.PREFIX || "jam!";
        return (interaction as Message).reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setTitle("❌ Error")
              .setDescription("Please provide a URL to download from!")
              .addFields({ name: "Usage", value: `${prefix}dl <url>` })
              .addFields({
                name: "Example",
                value: `${prefix}dl https://youtube.com/watch?v=...`,
              }),
          ],
        });
      }
      // Look for a "linkonly" flag (any argument that equals "linkonly")
      const remainingArgs = args.slice(2);
      if (remainingArgs.some((arg) => arg.toLowerCase() === "linkonly")) {
        linkOnlyFlag = true;
      }
      // You can further parse additional options from prefix if needed
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
      mediaUrl = (interaction as ChatInputCommandInteraction).options.getString(
        "url",
        true,
      );

      // Collect API options dynamically for slash command
      for (const optionName of [
        "videoquality",
        "audioformat",
        "audiobitrate",
        "filenamestyle",
        "downloadmode",
      ]) {
        const value = (
          interaction as ChatInputCommandInteraction
        ).options.getString(optionName);
        if (value) apiOptions[optionName] = value;
      }
      for (const optionName of [
        "alwaysproxy",
        "disablemetadata",
        "tiktokfullaudio",
        "tiktokh265",
        "twitterbskygif",
      ]) {
        const value = (
          interaction as ChatInputCommandInteraction
        ).options.getBoolean(optionName);
        if (value !== null) apiOptions[optionName] = value;
      }

      // Get the linkonly flag as well
      const linkOnly = (
        interaction as ChatInputCommandInteraction
      ).options.getBoolean("linkonly");
      if (linkOnly) linkOnlyFlag = true;
    }

    try {
      const apiResponse: JambaltApiResponse = await callJambaltApi(
        mediaUrl,
        apiOptions,
      );
      const data = apiResponse?.data;
      if (!data) {
        throw new Error("No response data from API.");
      }
      if (data.status === "redirect" || data.status === "tunnel") {
        const downloadUrl = data.url;
        // If the linkonly flag is true, or if file size is too big,
        // then send the link only
        if (linkOnlyFlag) {
          const response = `👋 [Download here](${downloadUrl})\n(The link expires; run the command again to regenerate.)`;
          if (isPrefix) {
            await (interaction as Message).reply({ content: response });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              content: response,
            });
          }
          return;
        }

        // Use a HEAD request to get file size from server headers
        let contentLength = 0;
        try {
          const headResponse = await axios.head(downloadUrl);
          if (headResponse.headers["content-length"]) {
            contentLength = parseInt(
              headResponse.headers["content-length"],
              10,
            );
          }
        } catch (headError) {
          Logger.warn(
            "HEAD request failed, defaulting to link-only",
            headError,
          );
          // If HEAD fails, fallback to sending the link only.
          const response = `👋 [Download here](${downloadUrl})\n(The link expires; run the command again to regenerate.)`;
          if (isPrefix) {
            await (interaction as Message).reply({ content: response });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              content: response,
            });
          }
          return;
        }

        if (contentLength > MAX_FILE_SIZE) {
          const response = `⚠️ File size (${Math.round(contentLength / (1024 * 1024))}MB) exceeds 25MB.\nDownload here: [link](${downloadUrl})`;
          if (isPrefix) {
            await (interaction as Message).reply({ content: response });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              content: response,
            });
          }
          return;
        }

        // File is within limit; download and upload it.
        try {
          const fileResponse = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
          });
          const buffer = Buffer.from(fileResponse.data);
          // Use new AttachmentBuilder from discord.js
          const attachment = new AttachmentBuilder(buffer, {
            name: "downloaded_file",
          });
          if (isPrefix) {
            await (interaction as Message).reply({ files: [attachment] });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              files: [attachment],
            });
          }
          // Buffer will be garbage collected once out of scope
        } catch (downloadError) {
          Logger.error("Error downloading file:", downloadError);
          const errorMsg =
            "❌ Failed to download the file despite being under 25MB.";
          if (isPrefix) {
            await (interaction as Message).reply({ content: errorMsg });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              content: errorMsg,
            });
          }
        }
      } else if (data.status === "error") {
        const errorCode = data.error?.code || "Unknown Error";
        Logger.warn(`API Error: ${errorCode}`, data.error);
        if (
          errorCode === "error.api.service.disabled" ||
          errorCode === "error.api.service.notfound"
        ) {
          const embed = new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("Service Unavailable")
            .setDescription(
              "The requested service is currently not supported or could not be found. Please try a different platform.",
            );
          if (isPrefix) {
            await (interaction as Message).reply({ embeds: [embed] });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              embeds: [embed],
            });
          }
        } else {
          const embed = new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("❌ Error")
            .setDescription(`An error occurred: ${errorCode}`);
          if (isPrefix) {
            await (interaction as Message).reply({ embeds: [embed] });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              embeds: [embed],
            });
          }
        }
      }
    } catch (error) {
      Logger.error("Error in command execution:", error);
      const embed = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("❌ Error")
        .setDescription(
          "An unexpected error occurred while processing your request.",
        );
      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    }
  },
};

