// commands/dl.ts
import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { callJambaltApi, type JambaltApiResponse } from "../../utils/jambaltApi";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dl")
    .setDescription("Generates a download link")
    .setDMPermission(true)
    .addStringOption((o) =>
      o.setName("url").setDescription("The URL to download").setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName("videoquality")
        .setDescription("144 / ... / max")
        .setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("audioformat").setDescription("best / mp3 / ogg / wav / opus")
    )
    .addStringOption((o) =>
      o
        .setName("audiobitrate")
        .setDescription("320 / 256 / 128 / 96 / 64 / 8")
    )
    .addStringOption((o) =>
      o
        .setName("filenamestyle")
        .setDescription("classic / pretty / basic / nerdy")
    )
    .addStringOption((o) =>
      o
        .setName("downloadmode")
        .setDescription("auto / audio / mute")
    )
    .addBooleanOption((o) =>
      o.setName("alwaysproxy").setDescription("true / false")
    )
    .addBooleanOption((o) =>
      o.setName("disablemetadata").setDescription("true / false")
    )
    .addBooleanOption((o) =>
      o.setName("tiktokfullaudio").setDescription("true / false")
    )
    .addBooleanOption((o) =>
      o.setName("tiktokh265").setDescription("true / false")
    )
    .addBooleanOption((o) =>
      o.setName("twittergif").setDescription("true / false")
    )
    .addBooleanOption((o) =>
      o.setName("youtubehls").setDescription("true / false"),
    ),

  prefix: {
    aliases: ["dl", "download"],
    usage: "<url> [options]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false
  ) {
    // 1) Extract the media URL
    let mediaUrl: string;
    const apiOptions: Record<string, any> = {};

    if (isPrefix) {
      const parts = (interaction as Message).content.trim().split(/\s+/);
      mediaUrl = parts[1];
      if (!mediaUrl) {
        return (interaction as Message).reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setTitle("❌ Error")
              .setDescription("Please provide a URL to download from!")
              .addFields([
                { name: "Usage", value: `${process.env.PREFIX || "jam!"}dl <url>` },
                { name: "Example", value: `${process.env.PREFIX || "jam!"}dl https://youtube.com/watch?v=...` },
              ]),
          ],
        });
      }
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
      mediaUrl = interaction.options.getString("url", true);
    }

    // 2) Map Discord options → Cobalt API keys
    const stringMap: Record<string, string> = {
      videoquality: "videoQuality",
      audioformat: "audioFormat",
      audiobitrate: "audioBitrate",
      filenamestyle: "filenameStyle",
      downloadmode: "downloadMode",
    };
    const boolMap: Record<string, string> = {
      alwaysproxy: "alwaysProxy",
      disablemetadata: "disableMetadata",
      tiktokfullaudio: "tiktokFullAudio",
      tiktokh265: "tiktokH265",
      twittergif: "twitterGif",
      youtubehls: "youtubeHLS",
    };

    for (const [opt, key] of Object.entries(stringMap)) {
      const val = isPrefix
        ? undefined
        : interaction.options.getString(opt);
      if (val) apiOptions[key] = val;
    }
    for (const [opt, key] of Object.entries(boolMap)) {
      const val = isPrefix
        ? undefined
        : interaction.options.getBoolean(opt);
      if (val !== null) apiOptions[key] = val;
    }

    // 3) Call the API
    try {
      const { data } = await callJambaltApi(mediaUrl, apiOptions);

      switch (data.status) {
        case "redirect":
        case "tunnel": {
          const link = `👋 [Download here](${data.url})\n_(expires soon)_`;
          if (isPrefix) {
            await (interaction as Message).reply({ content: link });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({ content: link });
          }
          break;
        }
        case "error": {
          const code = data.error?.code || "Unknown Error";
          Logger.warn(`API Error (${code})`, data.error);
          const msg =
            code === "error.api.service.disabled" ||
            code === "error.api.service.notfound"
              ? new EmbedBuilder()
                  .setColor("#ff3838")
                  .setTitle("Service Unavailable")
                  .setDescription(
                    "This platform is not supported or currently disabled."
                  )
              : { content: `❌ Download failed! API returned error: ${code}` };

          if (isPrefix) {
            await (interaction as Message).reply(msg);
          } else {
            await (interaction as ChatInputCommandInteraction).editReply(msg);
          }
          break;
        }
        case "picker": {
          const warning = "⚠️ Multiple items found. Try a more direct URL.";
          if (isPrefix) {
            await (interaction as Message).reply({ content: warning });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({ content: warning });
          }
          break;
        }
        default: {
          const unexpected = "❌ Download failed due to unexpected response.";
          if (isPrefix) {
            await (interaction as Message).reply({ content: unexpected });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({ content: unexpected });
          }
        }
      }
    } catch (err) {
      Logger.error("DL command error:", err);
      const embed = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("❌ Download Failed")
        .setDescription("An unexpected error occurred.")
        .setTimestamp();
      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed] });
      }
    }
  },
};

