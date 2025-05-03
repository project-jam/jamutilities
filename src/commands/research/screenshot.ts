import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { ProfaneDetect, DetectionResult } from "@projectjam/profane-detect";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("screenshot")
    .setDMPermission(true)
    .setDescription("Take a screenshot of a website")
    .addStringOption((opt) =>
      opt
        .setName("url")
        .setDescription("The website URL")
        .setRequired(true)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("fullpage")
        .setDescription("Capture the full page (BetterPlan only)")
        .setRequired(false)
    ),

  prefix: {
    aliases: ["screenshot", "ss", "capture"],
    usage: "<url> [--full]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false
  ): Promise<void> {
    try {
      // 1️⃣ Parse arguments
      let rawInput: string;
      let fullPage = false;
      let initialMessage: Message;

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
        rawInput = args[1];
        fullPage = args.includes("--full");
      } else {
        const slash = interaction as ChatInputCommandInteraction;
        rawInput = slash.options.getString("url", true);
        fullPage = slash.options.getBoolean("fullpage") ?? false;
      }

      // 2️⃣ Normalize & validate URL
      let url = rawInput;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        const invalidEmbed = new EmbedBuilder()
          .setTitle("❌ Invalid URL")
          .setDescription("Please provide a valid URL!")
          .setColor("#FF0000")
          .setTimestamp();

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [invalidEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({
            embeds: [invalidEmbed],
            ephemeral: true,
          });
        }
        return;
      }

      // 3️⃣ Profanity check: split hostname and path into words
      const hostText = parsed.hostname.replace(/[\.\-]/g, " "); // e.g. "pornhub com"
      const pathText = parsed.pathname.replace(/[\//]/g, " ").trim(); // e.g. "penis"
      const combinedText = [hostText.trim(), pathText].filter(Boolean).join(" ");

      const profanityDetector = new ProfaneDetect({ useFastLookup: true });
      const profanityResult: DetectionResult = profanityDetector.detect(combinedText);
      if (profanityResult.found) {
        const profanityEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setTitle("⚠️ Content Warning")
          .setDescription(
            "Your URL has been flagged for inappropriate content.\nPlease revise and try again."
          )
          .setTimestamp();

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [profanityEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({
            embeds: [profanityEmbed],
            ephemeral: true,
          });
        }
        return;
      }

      // 4️⃣ Send loading indicator
      const loadingEmbed = new EmbedBuilder()
        .setTitle("🔄 Taking Screenshot")
        .setDescription(`Capturing screenshot of ${parsed.href}…`)
        .setColor("#FFA500")
        .setTimestamp();

      if (isPrefix) {
        initialMessage = await (interaction as Message).reply({
          embeds: [loadingEmbed],
        });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({ embeds: [loadingEmbed] });
      }

      // 5️⃣ Build Thum.io URL
      const flags = [
        "maxAge/1",
        "noanimate",
        "width/1080",
        fullPage ? "fullpage" : null,
      ]
        .filter(Boolean)
        .join("/");

      const screenshotUrl = `https://image.thum.io/get/${flags}/?url=${encodeURIComponent(
        parsed.href
      )}`;

      // 6️⃣ Fetch screenshot
      const response = await fetch(screenshotUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/114.0.0.0 Safari/537.36",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // 7️⃣ Send result embed
      const resultEmbed = new EmbedBuilder()
        .setTitle("📸 Website Screenshot")
        .setDescription(`Screenshot of ${parsed.href}`)
        .setImage(screenshotUrl)
        .setColor("#00FF00")
        .setTimestamp();

      if (isPrefix) {
        await initialMessage.edit({ embeds: [resultEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({ embeds: [resultEmbed] });
      }
    } catch (err) {
      console.error("Error in screenshot command:", err);
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription(
          err instanceof Error
            ? `Failed to capture screenshot: ${err.message}`
            : "Failed to capture screenshot. Please try again later."
        )
        .setColor("#FF0000")
        .setTimestamp();

      if (isPrefix) {
        const channel = (interaction as Message).channel;
        if (channel) await channel.send({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({ embeds: [errorEmbed] });
      }
    }
  },
};

