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
import { ProfaneDetect } from "@projectjam/profane-detect";
import axios from "axios";

// Initialize profanity detector
const profanityDetector = new ProfaneDetect({
  caseSensitive: true,
});

interface SameEnergyImage {
  id: string;
  sha1: string;
  prefix: string;
  width: number;
  height: number;
  metadata: {
    source: string;
    caption: string | null;
    title: string | null;
    post_url: string;
    original_url: string;
    tags: Record<string, any>;
  };
}

interface SameEnergyResponse {
  kind: string;
  payload?: {
    images: SameEnergyImage[];
    seconds_taken: number;
  };
  message?: string;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sameimage")
    .setDescription("Search for images using Same Energy")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("What to search for")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How many images to fetch (default: 10, max: 50)")
        .setMinValue(1)
        .setMaxValue(50),
    ),

  prefix: {
    aliases: ["same", "si", "simg"],
    usage: "<query> [amount]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    let query: string;
    let amount: number = 10;

    // Handle prefix command parsing
    if (isPrefix) {
      const args = (interaction as Message).content.split(" ").slice(1);
      if (!args.length) {
        return await (interaction as Message).reply(
          "Please provide a search term!",
        );
      }

      // Check if last argument is a number for amount
      const lastArg = args[args.length - 1];
      if (/^\d+$/.test(lastArg)) {
        amount = Math.min(Math.max(parseInt(lastArg), 1), 50);
        args.pop();
      }

      query = args.join(" ");
      await (interaction as Message).channel.sendTyping();
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
      query = interaction.options.getString("query", true);
      amount = interaction.options.getInteger("amount") || 10;
    }

    // Profanity check
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

    try {
      // Initial progress message
      const progressEmbed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setDescription("🔍 Searching for images...");

      const progressMsg = isPrefix
        ? await (interaction as Message).reply({ embeds: [progressEmbed] })
        : await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [progressEmbed],
          });

      // Make the API request
      const response = await axios.get<SameEnergyResponse>(
        `https://imageapi.same.energy/search`,
        {
          params: {
            text: query,
            n: amount,
          },
        },
      );

      if (response.data.kind !== "success" || !response.data.payload) {
        throw new Error("Failed to fetch images");
      }

      const images = response.data.payload.images;

      if (images.length === 0) {
        const noResultsEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ No images found for your search.");

        if (isPrefix) {
          return await progressMsg.edit({ embeds: [noResultsEmbed] });
        } else {
          return await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [noResultsEmbed],
          });
        }
      }

      let currentPage = 0;

      const createEmbed = (pageIndex: number) => {
        const image = images[pageIndex];
        const imageUrl = `https://i.same.energy/${image.prefix}/${image.id}`;

        return new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle(`🖼️ ${image.metadata.title || "Untitled"}`)
          .setDescription(
            [
              `📍 Source: ${image.metadata.source}`,
              `🔍 [View Original](${image.metadata.post_url || image.metadata.original_url})`,
            ].join("\n"),
          )
          .setImage(imageUrl)
          .setFooter({
            text: `Image ${pageIndex + 1}/${images.length} • Query: ${query}`,
            iconURL: isPrefix
              ? (interaction as Message).author.displayAvatarURL()
              : (
                  interaction as ChatInputCommandInteraction
                ).user.displayAvatarURL(),
          });
      };

      const createButtons = (pageIndex: number) => {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("same_first")
            .setEmoji("⏮️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
          new ButtonBuilder()
            .setCustomId("same_prev")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
          new ButtonBuilder()
            .setCustomId("same_next")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === images.length - 1),
          new ButtonBuilder()
            .setCustomId("same_last")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === images.length - 1),
        );
      };

      await progressMsg.edit({
        embeds: [createEmbed(currentPage)],
        components: [createButtons(currentPage)],
      });

      const collector = progressMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
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
          case "same_first":
            currentPage = 0;
            break;
          case "same_prev":
            currentPage = Math.max(0, currentPage - 1);
            break;
          case "same_next":
            currentPage = Math.min(images.length - 1, currentPage + 1);
            break;
          case "same_last":
            currentPage = images.length - 1;
            break;
        }

        await i.update({
          embeds: [createEmbed(currentPage)],
          components: [createButtons(currentPage)],
        });
      });

      collector.on("end", () => {
        progressMsg.edit({ components: [] }).catch(() => {});
      });
    } catch (error) {
      Logger.error("Error in same image search:", error);
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

