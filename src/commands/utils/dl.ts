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
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const mediaUrl = interaction.options.getString("url", true);
    // Collect API options dynamically
    const apiOptions: Record<string, any> = {};
    for (const optionName of [
      "videoquality",
      "audioformat",
      "audiobitrate",
      "filenamestyle",
      "downloadmode",
    ]) {
      const value = interaction.options.getString(optionName);
      if (value) apiOptions[optionName] = value;
    }
    for (const optionName of [
      "alwaysproxy",
      "disablemetadata",
      "tiktokfullaudio",
      "tiktokh265",
      "twitterbskygif",
    ]) {
      const value = interaction.options.getBoolean(optionName);
      if (value !== null) apiOptions[optionName] = value;
    }
    try {
      const apiResponse = await callJambaltApi(mediaUrl, apiOptions);
      const data = apiResponse?.data;
      if (!data) {
        throw new Error("No response data from API.");
      }
      Logger.debug(`API Response Status: ${apiResponse.response?.status}`);
      Logger.debug(`API Data Status: ${data.status}`);
      if (data.status === "redirect" || data.status === "tunnel") {
        const downloadUrl = data.url;
        await interaction.editReply({
          content: `[👋 Download here!](${downloadUrl})\n*(The link expires; run the command again to regenerate.)*`,
        });
      } else if (data.status === "error") {
        const errorCode = data.error?.code || "Unknown Error";
        Logger.warn(`API Error: ${errorCode}`, data.error);
        // Check for disabled or not found services, and respond with an embed.
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
          await interaction.editReply({ embeds: [embed] });
        } else {
          await interaction.editReply({
            content: `❌ Download failed! API returned error: ${errorCode}`,
          });
        }
      } else if (data.status === "picker") {
        Logger.warn("Picker response received from API.", data);
        await interaction.editReply({
          content:
            "⚠️ Multiple download options available. Please try a more direct link.",
        });
      } else {
        Logger.warn("Unexpected API response:", data);
        await interaction.editReply({
          content: "❌ Download failed! Unexpected API response.",
        });
      }
    } catch (error) {
      Logger.error("DL command execution error:", error);
      await interaction.editReply({
        content: "❌ Download failed! An unexpected error occurred.",
      });
    }
  },
};
