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
    let amount = 10;

    // Parse command
    if (isPrefix) {
      const args = (interaction as Message).content.split(" ").slice(1);
      if (!args.length) {
        return await (interaction as Message).reply("Please provide a search term!");
      }

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
      const embed = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("⚠️ Content Warning")
        .setDescription(
          "Your search query has been flagged for inappropriate content.\nPlease revise your query and try again."
        )
        .setTimestamp();
      return isPrefix
        ? await (interaction as Message).reply({ embeds: [embed] })
        : await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed] });
    }

    try {
      const progressEmbed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setDescription("🔍 Searching for images...");

      const progressMsg = isPrefix
        ? await (interaction as Message).reply({ embeds: [progressEmbed] })
        : await (interaction as ChatInputCommandInteraction).editReply({ embeds: [progressEmbed] });

      // Polling Same Energy API
      let images: SameEnergyImage[] = [];
      for (let attempt = 0; attempt < 20; attempt++) {
        const res = await axios.get<SameEnergyResponse>("https://imageapi.same.energy/search", {
          params: { text: query, n: amount },
        });

        if (res.data.kind === "success" && res.data.payload) {
          images = res.data.payload.images;
          break;
        }

        if (res.data.kind === "error") {
          throw new Error(res.data.message || "Failed to fetch images");
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!images.length) {
        const embed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ No images found for your search.");
        return isPrefix
          ? await progressMsg.edit({ embeds: [embed] })
          : await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed] });
      }

      let currentPage = 0;

      const createEmbed = (index: number) => {
        const img = images[index];
        const imageUrl = `https://i.same.energy/${img.prefix}/${img.id}`;

        return new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle(`🖼️ ${img.metadata.title || "Untitled"}`)
          .setDescription(
            `📍 Source: ${img.metadata.source}\n🔍 [View Original](${img.metadata.post_url || img.metadata.original_url})`
          )
          .setImage(imageUrl)
          .setFooter({
            text: `Image ${index + 1}/${images.length} • Query: ${query}`,
            iconURL: isPrefix
              ? (interaction as Message).author.displayAvatarURL()
              : (interaction as ChatInputCommandInteraction).user.displayAvatarURL(),
          });
      };

      const createButtons = (index: number) =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("same_first")
            .setEmoji("⏮️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId("same_prev")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId("same_next")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === images.length - 1),
          new ButtonBuilder()
            .setCustomId("same_last")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === images.length - 1)
        );

      await progressMsg.edit({ embeds: [createEmbed(currentPage)], components: [createButtons(currentPage)] });

      const collector = progressMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== (isPrefix ? (interaction as Message).author.id : (interaction as ChatInputCommandInteraction).user.id)) {
          await i.reply({ content: "❌ These buttons aren't for you!", ephemeral: true });
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

        await i.update({ embeds: [createEmbed(currentPage)], components: [createButtons(currentPage)] });
      });

      collector.on("end", () => progressMsg.edit({ components: [] }).catch(() => {}));
    } catch (error) {
      Logger.error("Error in same image search:", error);
      const embed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ An error occurred while processing your request.");
      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed] });
      }
    }
  },
};

