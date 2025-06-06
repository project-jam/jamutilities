import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import fetch from "node-fetch";
import { ProfaneDetect } from "@projectjam/profane-detect";

// Initialize with proper configuration
const profanityDetector = new ProfaneDetect({
  caseSensitive: true,
});

interface ImageSearchResponse {
  query: string;
  language: string;
  count: number;
  images: string[];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("image")
    .setDescription("Image-related commands")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("search")
        .setDescription("Search for images using Google Images")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("What image to search for")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("language")
            .setDescription("Search language (default: en)")
            .setRequired(false)
            .addChoices(
              { name: "English", value: "en" },
              { name: "Japanese", value: "ja" },
              { name: "Spanish", value: "es" },
              { name: "French", value: "fr" },
              { name: "German", value: "de" },
              { name: "Korean", value: "ko" },
              { name: "Chinese", value: "zh" },
              { name: "Russian", value: "ru" },
              { name: "Portuguese", value: "pt" },
              { name: "Italian", value: "it" },
            ),
        ),
    ),
  prefix: {
    aliases: ["imagesearch", "is"],
    usage: "[country=language] <query>",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    if (!isPrefix) {
      await (interaction as ChatInputCommandInteraction).deferReply();
    }

    try {
      let query: string;
      let language: string = "en";

      if (isPrefix) {
        const args = (interaction as Message).content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/g)
          .slice(1);

        if (args.length < 1) {
          const prefix = process.env.PREFIX || "jam!";
          await (interaction as Message).reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide a search query!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${prefix}imagesearch [country=language] <query>`,
                    `${prefix}is [country=language] <query>`,
                    "",
                    "Available languages:",
                    "en, ja, es, fr, de, ko, zh, ru, pt, it",
                    "",
                    "Examples:",
                    `${prefix}imagesearch country=ja cats`,
                    `${prefix}is country=en cute dogs`,
                    `${prefix}imagesearch country=ko music`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        query = args.join(" ");
        const countryMatch = query.match(
          /country=(ja|en|es|fr|de|ko|zh|ru|pt|it)/i,
        );
        if (countryMatch) {
          language = countryMatch[1].toLowerCase();
          query = query.replace(/country=[a-z]{2}/i, "").trim();
        }

        await (interaction as Message).channel.sendTyping();
      } else {
        query = (interaction as ChatInputCommandInteraction).options.getString(
          "query",
          true,
        );
        language =
          (interaction as ChatInputCommandInteraction).options.getString(
            "language",
          ) || "en";
      }

      Logger.info(`Processing image search query: ${query}`);

      // Profanity Check
      const profanityResult = profanityDetector.detect(query);
      if (profanityResult.found) {
        const profanityEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setTitle("⚠️ Content Warning")
          .setDescription(
            "Your search query has been flagged for inappropriate content.\nPlease revise your query and try again.",
          )
          .setTimestamp();

        if (isPrefix) {
          return await (interaction as Message).reply({
            embeds: [profanityEmbed],
          });
        } else {
          return await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [profanityEmbed],
          });
        }
      }

      // API Call
      const response = await fetch(
        `https://api.project-jam.is-a.dev/api/v0/image/image-search/google?q=${encodeURIComponent(
          query,
        )}&lang=${language}`,
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = (await response.json()) as ImageSearchResponse;

      if (!data.images || data.images.length === 0) {
        const noResultsEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ No images found for your search.");

        if (isPrefix) {
          return await (interaction as Message).reply({
            embeds: [noResultsEmbed],
          });
        } else {
          return await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [noResultsEmbed],
          });
        }
      }

      let currentPage = 0;
      const avatarURL = isPrefix
        ? (interaction as Message).author.displayAvatarURL({
            format: "png",
            size: 64,
          })
        : (interaction as ChatInputCommandInteraction).user.displayAvatarURL({
            format: "png",
            size: 64,
          });

      const createEmbed = (pageIndex: number) => {
        const languageNames: { [key: string]: string } = {
          en: "English",
          ja: "Japanese",
          es: "Spanish",
          fr: "French",
          de: "German",
          ko: "Korean",
          zh: "Chinese",
          ru: "Russian",
          pt: "Portuguese",
          it: "Italian",
        };

        return new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle(`🖼️ Search Results: ${query}`)
          .setDescription(`🔍 Showing ${data.images.length} results`)
          .setImage(data.images[pageIndex])
          .setFooter({
            text: `Image ${pageIndex + 1}/${data.images.length} • Language: ${
              languageNames[language] || language
            } • Note: SafeSearch is turned on. Please be cautious.`,
            iconURL: avatarURL,
          });
      };

      const createButtons = (pageIndex: number) => {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("image_first")
            .setEmoji("⏮️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
          new ButtonBuilder()
            .setCustomId("image_prev")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
          new ButtonBuilder()
            .setCustomId("image_next")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === data.images.length - 1),
          new ButtonBuilder()
            .setCustomId("image_last")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === data.images.length - 1),
        );
      };

      const initialEmbed = createEmbed(currentPage);
      const initialButtons = createButtons(currentPage);

      // Send initial message
      const message = isPrefix
        ? await (interaction as Message).reply({
            embeds: [initialEmbed],
            components: [initialButtons],
            fetchReply: true,
          })
        : await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [initialEmbed],
            components: [initialButtons],
          });

      // Create collector
      const collector = (message as Message).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
      });

      collector.on("collect", async (i) => {
        if (
          i.user.id !==
          (isPrefix
            ? (interaction as Message).author.id
            : (interaction as ChatInputCommandInteraction).user.id)
        ) {
          await i.reply({
            content: "❌ These buttons aren't for you!",
            ephemeral: true,
          });
          return;
        }

        switch (i.customId) {
          case "image_first":
            currentPage = 0;
            break;
          case "image_prev":
            currentPage = Math.max(0, currentPage - 1);
            break;
          case "image_next":
            currentPage = Math.min(data.images.length - 1, currentPage + 1);
            break;
          case "image_last":
            currentPage = data.images.length - 1;
            break;
        }

        await i.update({
          embeds: [createEmbed(currentPage)],
          components: [createButtons(currentPage)],
        });
      });

      collector.on("end", () => {
        if (isPrefix) {
          (message as Message).edit({ components: [] }).catch(() => {});
        } else {
          (interaction as ChatInputCommandInteraction)
            .editReply({ components: [] })
            .catch(() => {});
        }
      });
    } catch (error) {
      Logger.error("Error in image search:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ An error occurred while processing your request.");

      if (isPrefix) {
        return await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        return await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};

