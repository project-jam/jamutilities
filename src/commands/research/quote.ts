import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface VercelQuoteResponse {
  quote: string;
  author: string;
}

interface DummyJsonQuoteResponse {
  id: number;
  quote: string;
  author: string;
}

const QUOTE_APIS = {
  VERCEL_QUOTES_API: "https://quotes-api-self.vercel.app/quote",
  DUMMY_JSON: "https://dummyjson.com/quotes/random",
};

const getRandomElement = (arr: any[]) =>
  arr[Math.floor(Math.random() * arr.length)];

const colors = [
  "#FF6B6B", // Coral Red
  "#4ECDC4", // Turquoise
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage Green
  "#FFEEAD", // Cream Yellow
  "#D4A5A5", // Dusty Rose
  "#9B59B6", // Purple
  "#3498DB", // Blue
  "#E67E22", // Orange
  "#2ECC71", // Green
];

const quoteDecorations = [
  "「」",
  "『』",
  "❝❞",
  "«»",
  "‹›",
  "“”",
  "❮❯",
  "〝〞",
  "﹂﹁",
  "⟨⟩",
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Get an inspirational quote")
    .setDMPermission(true),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const apiUrl = getRandomElement(Object.values(QUOTE_APIS));
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const quoteText = data.quote;
      const authorName = data.author;
      const quoteId = "id" in data ? `#${data.id}` : "";

      const randomColor = getRandomElement(colors);
      const [openQuote, closeQuote] =
        getRandomElement(quoteDecorations).split("");

      const embed = new EmbedBuilder()
        .setColor(randomColor)
        .setDescription(`${openQuote}${quoteText}${closeQuote}`)
        .setFooter({
          text: `― ${authorName}${quoteId ? ` | Quote ${quoteId}` : ""}`,
        })
        .setTimestamp();

      if (Math.random() > 0.5) {
        const headers = [
          "✨ Quote of the Moment",
          "💭 Random Thoughts",
          "📖 Words of Wisdom",
          "🌟 Inspirational Quote",
          "💫 Thought for Today",
          "🎯 Food for Thought",
          "🌈 Daily Inspiration",
          "💡 Wisdom Spark",
        ];
        embed.setTitle(getRandomElement(headers));
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Quote command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Failed to fetch a quote. Try again later."),
        ],
      });
    }
  },
};
