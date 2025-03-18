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
import fetch from "node-fetch"; // Import fetch if not available

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
    usage: "[language] <query>", // e.g. jam!imagesearch cute cats ja
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
                    `${prefix}imagesearch <query> [language]`,
                    `${prefix}is <query> [language]`,
                    "",
                    "Available languages:",
                    "en, ja, es, fr, de, ko, zh, ru, pt, it",
                    "",
                    "Examples:",
                    `${prefix}imagesearch cute cats`,
                    `${prefix}is sakura ja`,
                    `${prefix}imagesearch discord`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }
        query = args.join(" ");
        // If the last argument is a valid language code, separate it.
        const parts = query.split(" ");
        const possibleLang = parts[parts.length - 1].toLowerCase();
        if (
          ["en", "ja", "es", "fr", "de", "ko", "zh", "ru", "pt", "it"].includes(
            possibleLang,
          )
        ) {
          language = possibleLang;
          query = parts.slice(0, -1).join(" ");
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

      let response;
      try {
        response = await fetch(
          `https://api.project-jam.is-a.dev/api/v0/image/image-search/google?q=${encodeURIComponent(query)}&lang=${language}`,
        );
      } catch (fetchError) {
        Logger.error("Fetch error:", fetchError);
        throw new Error("Failed to fetch image search results.");
      }
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      let data;
      try {
        data = (await response.json()) as ImageSearchResponse;
      } catch (jsonError) {
        Logger.error("JSON parsing error:", jsonError);
        throw new Error("Failed to parse image search results.");
      }
      if (!data.images || data.images.length === 0) {
        const noResultsEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ No images found for your search.");
        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [noResultsEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [noResultsEmbed],
          });
        }
        return;
      }
      let currentPage = 0;

      // Determine the correct avatar URL based on the interaction type.
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
            text: `Image ${pageIndex + 1}/${data.images.length} • Language: ${languageNames[language] || language} • Note: SafeSearch is turned on. Please be cautious.`,
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

      const embed = createEmbed(currentPage);
      const buttons = createButtons(currentPage);
      const message = isPrefix
        ? await (interaction as Message).reply({
            embeds: [embed],
            components: [buttons],
            fetchReply: true,
          })
        : await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [embed],
            components: [buttons],
          });

      const collector = (message as Message).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
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
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
