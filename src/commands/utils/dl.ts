import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import {
  callJambaltApi,
  type JambaltApiResponse,
} from "../../utils/jambaltApi";

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
              .addFields({
                name: "Usage",
                value: `${prefix}dl <url>`,
              })
              .addFields({
                name: "Example",
                value: `${prefix}dl https://youtube.com/watch?v=...`,
              }),
          ],
        });
      }
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
    }

    try {
      const apiResponse = await callJambaltApi(mediaUrl, apiOptions);
      const data = apiResponse?.data;

      if (!data) {
        throw new Error("No response data from API.");
      }

      if (data.status === "redirect" || data.status === "tunnel") {
        const downloadUrl = data.url;
        const response = `👋 [Download here](${downloadUrl}) \n(The link expires; run the command again to regenerate.)`;

        if (isPrefix) {
          await (interaction as Message).reply({ content: response });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            content: response,
          });
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
          const response = `❌ Download failed! API returned error: ${errorCode}`;
          if (isPrefix) {
            await (interaction as Message).reply({ content: response });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              content: response,
            });
          }
        }
      } else if (data.status === "picker") {
        Logger.warn("Picker response received from API.", data);
        const response =
          "⚠️ Multiple download options available. Please try a more direct link.";

        if (isPrefix) {
          await (interaction as Message).reply({ content: response });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            content: response,
          });
        }
      } else {
        Logger.warn("Unexpected API response:", data);
        const response = "❌ Download failed! Unexpected API response.";

        if (isPrefix) {
          await (interaction as Message).reply({ content: response });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            content: response,
          });
        }
      }
    } catch (error) {
      Logger.error("DL command execution error:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("❌ Download Failed")
        .setDescription(
          "An unexpected error occurred while processing your request.",
        )
        .setTimestamp();

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
