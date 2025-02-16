///////////////////////////////////////////////
///// The command is in beta, be careful! /////
///////////////////////////////////////////////

import {
  ChatInputCommandInteraction,
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
        .setDescription(
          "Filename style (classic, pretty, basic, nerdy) (ONLY if you download it",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("downloadmode")
        .setDescription("Download mode (auto, audio, mute)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("youtubevideocodec")
        .setDescription(
          "YouTube video codec (h264, av1, vp9) (h264 is recommended) (This will not work, because we're working on adding the Youtube functions)",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("youtubedublang")
        .setDescription(
          "YouTube dub language code (e.g., en, ru) (This will not work, because we're working on adding the Youtube functions)",
        )
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
        .setDescription("Disable file metadata (eg. Artist, MP3 Info)")
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
        .setName("youtubehls")
        .setDescription(
          "Use HLS for YouTube downloads (This will not work, because we're working on adding the Youtube functions)",
        )
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const mediaUrl = interaction.options.getString("url", true);

    // Build API options with keys matching the slash command option names (all lower-case)
    const apiOptions: Record<string, any> = {};
    const videoquality = interaction.options.getString("videoquality");
    if (videoquality) apiOptions.videoquality = videoquality;
    const audioformat = interaction.options.getString("audioformat");
    if (audioformat) apiOptions.audioformat = audioformat;
    const audiobitrate = interaction.options.getString("audiobitrate");
    if (audiobitrate) apiOptions.audiobitrate = audiobitrate;
    const filenamestyle = interaction.options.getString("filenamestyle");
    if (filenamestyle) apiOptions.filenamestyle = filenamestyle;
    const downloadmode = interaction.options.getString("downloadmode");
    if (downloadmode) apiOptions.downloadmode = downloadmode;
    const youtubevideocodec =
      interaction.options.getString("youtubevideocodec");
    if (youtubevideocodec) apiOptions.youtubevideocodec = youtubevideocodec;
    const youtubedublang = interaction.options.getString("youtubedublang");
    if (youtubedublang) apiOptions.youtubedublang = youtubedublang;
    const alwaysproxy = interaction.options.getBoolean("alwaysproxy");
    if (alwaysproxy !== null) apiOptions.alwaysproxy = alwaysproxy;
    const disablemetadata = interaction.options.getBoolean("disablemetadata");
    if (disablemetadata !== null) apiOptions.disablemetadata = disablemetadata;
    const tiktokfullaudio = interaction.options.getBoolean("tiktokfullaudio");
    if (tiktokfullaudio !== null) apiOptions.tiktokfullaudio = tiktokfullaudio;
    const tiktokh265 = interaction.options.getBoolean("tiktokh265");
    if (tiktokh265 !== null) apiOptions.tiktokh265 = tiktokh265;
    const twittergif = interaction.options.getBoolean("twitterbskygif");
    if (twittergif !== null) apiOptions.twittergif = twittergif;
    const youtubehls = interaction.options.getBoolean("youtubehls");
    if (youtubehls !== null) apiOptions.youtubehls = youtubehls;

    try {
      const apiResponse = await callJambaltApi(mediaUrl, apiOptions);
      const data = apiResponse.data;
      const response = apiResponse.response;

      Logger.debug(`API Response Status: ${response?.status}`);
      Logger.debug(`API data?.status: ${data?.status}`);

      if (data && (data.status === "redirect" || data.status === "tunnel")) {
        const downloadUrl = data.url;
        const markdownLink = `-# [👋 Download here!](${downloadUrl}) (also the link expires, run the command again to regenerate the link)`;
        await interaction.editReply({ content: markdownLink });
      } else if (data && data.status === "error") {
        const errorCode = data.error?.code || "Unknown Error Code";
        Logger.debug(`API Error Code: ${errorCode}`);
        Logger.debug(`API data?.error?.code: ${data?.error?.code}`);
        const errorMessage = `❌ Download failed! API returned error: ${errorCode}`;
        Logger.warn(errorMessage, data.error);

        if (errorCode === "error.api.service.disabled") {
          const serviceNotSupportedEmbed = new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("Service Not Supported")
            .setDescription(
              "The requested service is currently not supported. Please try a different platform.",
            );
          await interaction.editReply({ embeds: [serviceNotSupportedEmbed] });
        } else {
          await interaction.editReply({ content: errorMessage });
        }
      } else if (data && data.status === "picker") {
        const pickerMessage =
          "⚠️ Multiple download options available. Picker response received. (Basic command, cannot handle picker directly). Please try a more direct link if possible.";
        await interaction.editReply({ content: pickerMessage });
        Logger.warn(
          "Picker response received from API. Basic command cannot handle picker yet.",
          data,
        );
      } else {
        const unexpectedMessage =
          "❌ Download failed!  Unexpected API response.";
        Logger.warn("Unexpected API response:", data);
        await interaction.editReply({ content: unexpectedMessage });
      }
    } catch (error) {
      Logger.error("DL command execution error:", error);
      await interaction.editReply({
        content: "❌ Download failed!  An unexpected error occurred.",
      });
    }
  },
};
