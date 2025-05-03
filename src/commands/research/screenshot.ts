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
        .setDescription("The website URL (including http:// or https://)")
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

      // 2️⃣ Protocol and domain checks
      // a) Check for ://
      if (!rawInput.includes('://')) {
        const protoEmbed = new EmbedBuilder()
          .setTitle("❌ Error")
          .setDescription("Where is ‘://’? Please include http:// or https:// in your URL.")
          .setColor("#FF0000")
          .setTimestamp();
        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [protoEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({ embeds: [protoEmbed], ephemeral: true });
        }
        return;
      }

      // b) Validate protocol (only http/https)
      if (!/^https?:\/\//i.test(rawInput)) {
        const httpEmbed = new EmbedBuilder()
          .setTitle("❌ Error")
          .setDescription("Error: you need to provide the HTTP protocol! e.g. https://example.com")
          .setColor("#FF0000")
          .setTimestamp();
        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [httpEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({ embeds: [httpEmbed], ephemeral: true });
        }
        return;
      }

      // c) Check for domain extension
      const withoutProto = rawInput.split('://')[1];
      if (!withoutProto.includes('.')) {
        const domainEmbed = new EmbedBuilder()
          .setTitle("❌ Error")
          .setDescription("You need to add a domain extension (e.g. .com, .net) in the URL.")
          .setColor("#FF0000")
          .setTimestamp();
        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [domainEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({ embeds: [domainEmbed], ephemeral: true });
        }
        return;
      }

      // 3️⃣ Normalize & validate URL
      let parsed: URL;
      try {
        parsed = new URL(rawInput);
      } catch {
        const invalidEmbed = new EmbedBuilder()
          .setTitle("❌ Invalid URL")
          .setDescription("Please provide a valid URL!")
          .setColor("#FF0000")
          .setTimestamp();
        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [invalidEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({ embeds: [invalidEmbed], ephemeral: true });
        }
        return;
      }

      // 4️⃣ Profanity check: split hostname and path into words
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
          await (interaction as ChatInputCommandInteraction).reply({ embeds: [profanityEmbed], ephemeral: true });
        }
        return;
      }

      // 5️⃣ Send loading indicator
      const loadingEmbed = new EmbedBuilder()
        .setTitle("🔄 Taking Screenshot")
        .setDescription(`Capturing screenshot of ${parsed.href}…`)
        .setColor("#FFA500")
        .setTimestamp();
      if (isPrefix) {
        initialMessage = await (interaction as Message).reply({ embeds: [loadingEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({ embeds: [loadingEmbed] });
      }

      // 6️⃣ Build Thum.io URL
      const flags = ["maxAge/1", "noanimate", "width/1080", fullPage ? "fullpage" : null]
        .filter(Boolean)
        .join("/");
      const screenshotUrl = `https://image.thum.io/get/${flags}/?url=${encodeURIComponent(parsed.href)}`;

      // 7️⃣ Fetch screenshot
      const response = await fetch(screenshotUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/114.0.0.0 Safari/537.36",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // 8️⃣ Send result embed
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

