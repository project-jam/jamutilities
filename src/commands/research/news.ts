import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

interface NewsArticle {
  title: string | null;
  summary: string | null;
  image_link: string | null;
  news_link: string;
}

interface NewsResponse {
  status: number;
  Latest?: NewsArticle[]; // English
  "Manşet haber"?: NewsArticle[]; // Turkish
  "مهمترین خبرها"?: NewsArticle[]; // Persian
  "الخبر الرئيسي"?: NewsArticle[]; // Arabic
  Главное?: NewsArticle[]; // Russian
  [key: string]: any; // Other sections/languages
}

const supportedLanguages = {
  english: "English",
  spanish: "Spanish",
  french: "French",
  chinese: "Chinese",
  arabic: "Arabic",
  russian: "Russian",
  portuguese: "Portuguese",
  japanese: "Japanese",
  turkish: "Turkish",
  vietnamese: "Vietnamese",
  indonesian: "Indonesian",
  ukrainian: "Ukrainian",
  persian: "Persian",
  urdu: "Urdu",
  hindi: "Hindi",
  bengali: "Bengali",
  tamil: "Tamil",
  marathi: "Marathi",
  nepali: "Nepali",
  uzbek: "Uzbek",
  azeri: "Azeri",
  kyrgyz: "Kyrgyz",
  burmese: "Burmese",
  sinhala: "Sinhala",
  pashto: "Pashto",
} as const;

// Map of language codes to their main news section names
const mainSectionNames: { [key: string]: string[] } = {
  english: ["Latest"],
  turkish: ["Manşet haber"],
  persian: ["مهمترین خبرها"],
  arabic: ["الخبر الرئيسي"],
  russian: ["Главное"],
};

type SupportedLanguage = keyof typeof supportedLanguages;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("news")
    .setDMPermission(true)
    .setDescription("Shows the latest BBC news headlines")
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("Select news language")
        .setRequired(false)
        .addChoices(
          ...Object.entries(supportedLanguages)
            .slice(0, 25)
            .map(([value, name]) => ({
              name,
              value,
            })),
        ),
    ),

  prefix: {
    aliases: ["news", "headlines", "bbc"],
    usage: "[language]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let language: string = "english"; // Default language

      if (isPrefix) {
        const args = (interaction as Message).content.split(" ");
        if (args[1]) {
          const requestedLang = args[1].toLowerCase();
          if (requestedLang in supportedLanguages) {
            language = requestedLang;
          } else {
            const supportedLangList = Object.entries(supportedLanguages)
              .map(([code, name]) => `${name} (\`${code}\`)`)
              .join(", ");

            const errorEmbed = new EmbedBuilder()
              .setTitle("❌ Invalid Language")
              .setDescription(
                `Please use one of the following languages:\n\n${supportedLangList}`,
              )
              .setColor("#FF0000")
              .setTimestamp();

            await (interaction as Message).reply({ embeds: [errorEmbed] });
            return;
          }
        }
      } else {
        const langOption = (
          interaction as ChatInputCommandInteraction
        ).options.getString("language");
        if (langOption) {
          language = langOption;
        }
      }

      // Create loading embed
      const loadingEmbed = new EmbedBuilder()
        .setTitle(
          `📰 BBC News (${supportedLanguages[language as SupportedLanguage]})`,
        )
        .setDescription(
          `🔄 Fetching latest news in ${
            supportedLanguages[language as SupportedLanguage]
          }...`,
        )
        .setColor("#BB1919")
        .setTimestamp();

      // Send initial response
      let initialMessage: Message | void;
      if (isPrefix) {
        initialMessage = await (interaction as Message).reply({
          embeds: [loadingEmbed],
        });
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
      }

      // Fetch news data
      const response = await fetch(
        `https://bbc-api.vercel.app/news?lang=${language}`,
      );

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = (await response.json()) as NewsResponse;

      // Find the main news section based on language
      let articles: NewsArticle[] | undefined;
      if (language in mainSectionNames) {
        // Try each possible section name for the language
        for (const sectionName of mainSectionNames[language]) {
          if (data[sectionName] && Array.isArray(data[sectionName])) {
            articles = data[sectionName];
            break;
          }
        }
      }

      // Fallback: try to find any array of news articles in the response
      if (!articles) {
        for (const [key, value] of Object.entries(data)) {
          if (
            Array.isArray(value) &&
            value.length > 0 &&
            value[0] &&
            "title" in value[0] &&
            "news_link" in value[0]
          ) {
            articles = value;
            break;
          }
        }
      }

      if (!articles || !Array.isArray(articles)) {
        throw new Error(
          `No news articles found for ${
            supportedLanguages[language as SupportedLanguage]
          }`,
        );
      }

      // Get the latest 5 news articles (to avoid hitting Discord's embed limits)
      const latestNews = articles
        .filter((article): article is NewsArticle => {
          return Boolean(article && article.title && article.news_link);
        })
        .slice(0, 5);

      if (latestNews.length === 0) {
        throw new Error(
          `No valid news articles available for ${
            supportedLanguages[language as SupportedLanguage]
          }`,
        );
      }

      const embed = new EmbedBuilder()
        .setTitle(
          `📰 BBC News (${supportedLanguages[language as SupportedLanguage]})`,
        )
        .setColor("#BB1919")
        .setTimestamp()
        .setFooter({
          text: "Powered by BBC News",
        });

      // Add news articles as fields
      latestNews.forEach((article) => {
        if (article.title) {
          embed.addFields({
            name: article.title,
            value: `${article.summary ? article.summary + "\n" : ""}[Read more](${
              article.news_link
            })`,
          });
        }
      });

      // Send or edit the response
      if (isPrefix) {
        if (initialMessage) {
          await initialMessage.edit({ embeds: [embed] });
        }
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription(
          error instanceof Error
            ? `Failed to fetch news: ${error.message}`
            : "Failed to fetch news. Please try again later.",
        )
        .setColor("#FF0000")
        .setTimestamp();

      if (isPrefix) {
        if (interaction.channel) {
          await interaction.channel.send({ embeds: [errorEmbed] });
        }
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }

      console.error("Error in news command:", error);
    }
  },
};
