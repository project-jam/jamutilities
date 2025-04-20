import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("screenshot")
    .setDMPermission(true)
    .setDescription("Take a screenshot of a website")
    .addStringOption((opt) =>
      opt.setName("url").setDescription("The website URL").setRequired(true),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("fullpage")
        .setDescription("Capture the full page (better‑plan only)")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["screenshot", "ss", "capture"],
    usage: "<url> [--full]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      // --- Parse arguments ---
      let url: string;
      let fullPage = false;

      if (isPrefix) {
        const msg = interaction as Message;
        const args = msg.content.trim().split(/\s+/);
        if (args.length < 2) {
          await msg.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription("Please provide a URL to screenshot!")
                .setColor("#FF0000")
                .setTimestamp(),
            ],
          });
          return;
        }
        url = args[1];
        fullPage = args.includes("--full");
      } else {
        const slash = interaction as ChatInputCommandInteraction;
        url = slash.options.getString("url", true);
        fullPage = slash.options.getBoolean("fullpage") ?? false;
      }

      // --- Normalize & validate URL ---
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }
      try {
        new URL(url);
      } catch {
        const invalid = new EmbedBuilder()
          .setTitle("❌ Invalid URL")
          .setDescription("Please provide a valid URL!")
          .setColor("#FF0000")
          .setTimestamp();
        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [invalid] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({
            embeds: [invalid],
          });
        }
        return;
      }

      // --- Send loading indicator ---
      const loadingEmbed = new EmbedBuilder()
        .setTitle("🔄 Taking Screenshot")
        .setDescription(`Capturing screenshot of ${url}…`)
        .setColor("#FFA500")
        .setTimestamp();

      let initialMessage: Message | void;
      if (isPrefix) {
        initialMessage = await (interaction as Message).reply({
          embeds: [loadingEmbed],
        });
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
      }

      // --- Build Thum.io URL using query‑param style ---
      const flags = [
        "maxAge/1", // cache for 1 hour
        "noanimate", // disable animated GIF
        "width/1080", // 1080px width
        fullPage ? "fullpage" : null, // full‑page if permitted
      ]
        .filter(Boolean)
        .join("/");

      const screenshotUrl = `https://image.thum.io/get/${flags}/?url=${encodeURIComponent(
        url,
      )}`;

      // --- Fetch the screenshot with Chrome UA ---
      const response = await fetch(screenshotUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/114.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // --- Build & send result embed ---
      const resultEmbed = new EmbedBuilder()
        .setTitle("📸 Website Screenshot")
        .setDescription(`Screenshot of ${url}`)
        .setImage(screenshotUrl)
        .setColor("#00FF00")
        .setTimestamp();

      if (isPrefix) {
        if (initialMessage) {
          await initialMessage.edit({ embeds: [resultEmbed] });
        }
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [resultEmbed],
        });
      }
    } catch (err) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription(
          err instanceof Error
            ? `Failed to capture screenshot: ${err.message}`
            : "Failed to capture screenshot. Please try again later.",
        )
        .setColor("#FF0000")
        .setTimestamp();

      if (isPrefix) {
        const channel = (interaction as Message).channel;
        if (channel) await channel.send({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }

      console.error("Error in screenshot command:", err);
    }
  },
};
