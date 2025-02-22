import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

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

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "search":
        await handleImageSearch(interaction);
        break;
      default:
        await interaction.reply({
          content: "Unknown subcommand",
          ephemeral: true,
        });
    }
  },
};

async function handleImageSearch(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const query = interaction.options.getString("query", true);
    const language = interaction.options.getString("language") || "en";
    let currentPage = 0;

    const response = await fetch(
      `https://api.project-jam.is-a.dev/api/v0/image-search/google?q=${encodeURIComponent(
        query,
      )}&lang=${language}`,
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data: ImageSearchResponse = await response.json();

    if (!data.images || data.images.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ No images found for your search."),
        ],
      });
      return;
    }

    // Function to create embed for current page
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
          text: `Image ${pageIndex + 1}/${data.images.length} • Language: ${languageNames[language] || language}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();
    };

    // Create navigation buttons
    const createButtons = (pageIndex: number) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("first")
          .setEmoji("⏮️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId("prev")
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === data.images.length - 1),
        new ButtonBuilder()
          .setCustomId("last")
          .setEmoji("⏭️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === data.images.length - 1),
        new ButtonBuilder()
          .setCustomId("stop")
          .setEmoji("⏹️")
          .setStyle(ButtonStyle.Danger),
      );
    };

    // Send initial message with first image and buttons
    const message = await interaction.editReply({
      embeds: [createEmbed(currentPage)],
      components: [createButtons(currentPage)],
    });

    // Create button collector
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minute timeout
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "❌ These buttons aren't for you!",
          ephemeral: true,
        });
        return;
      }

      // Handle stop button
      if (i.customId === "stop") {
        collector.stop("user_stopped");
        await i.update({
          components: [],
        });
        return;
      }

      // Update current page based on button pressed
      switch (i.customId) {
        case "first":
          currentPage = 0;
          break;
        case "prev":
          currentPage = Math.max(0, currentPage - 1);
          break;
        case "next":
          currentPage = Math.min(data.images.length - 1, currentPage + 1);
          break;
        case "last":
          currentPage = data.images.length - 1;
          break;
      }

      // Update message with new image and buttons
      await i.update({
        embeds: [createEmbed(currentPage)],
        components: [createButtons(currentPage)],
      });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        // Add a "Timed out" note to the embed
        const timedOutEmbed = EmbedBuilder.from(message.embeds[0])
          .setColor("#ff3838")
          .setFooter({
            text: `${message.embeds[0].footer?.text} • Interaction timed out`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        await message
          .edit({
            embeds: [timedOutEmbed],
            components: [],
          })
          .catch(() => {
            // Ignore any errors from editing expired messages
          });
      }
    });
  } catch (error) {
    Logger.error("Image search command failed:", error);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            "❌ Failed to search for images. Please try again later.",
          ),
      ],
    });
  }
}
