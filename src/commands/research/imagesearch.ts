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
import profaneWords from "profane-words"; // Correct import
import fetch from "node-fetch"; // Import fetch if not available

const swearWordUrls = [
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/ar",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/cs",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/de",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/eo",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/es",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/fa",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/fi",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/fr",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/fr-CA-u-sd-caqc",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/hi",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/hu",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/it",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/ja",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/ko",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/nl",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/no",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/pl",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/pt",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/ru",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/sv",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/tlh",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/tr",
  "https://raw.githubusercontent.com/chucknorris-io/swear-words/master/zh",
];

const homoglyphUrl =
  "https://raw.githubusercontent.com/codebox/homoglyph/refs/heads/master/raw_data/chars.txt";

let swearWordsList: string[] = [];
let homoglyphMap: Map<string, string> = new Map();

async function loadSwearWords() {
  try {
    for (let url of swearWordUrls) {
      const response = await fetch(url);
      if (!response.ok) {
        Logger.error(
          `Failed to fetch swear words from ${url}: ${response.status}`,
        );
        continue;
      }

      const data = await response.text();
      const words = data
        .split("\n")
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 0);
      swearWordsList = [...swearWordsList, ...words];
    }

    if (Array.isArray(profaneWords)) {
      swearWordsList = [...swearWordsList, ...profaneWords];
    }

    swearWordsList = [...new Set(swearWordsList)];
  } catch (error) {
    Logger.error("Error loading swear words:", error);
  }
}

async function loadHomoglyphs() {
  try {
    const response = await fetch(homoglyphUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch homoglyphs: ${response.status}`);
    }

    const data = await response.text();

    // Create a direct mapping from any character to its standard form
    const directMap = new Map<string, string>();

    // Process each non-comment line
    const lines = data
      .split("\n")
      .filter((line) => !line.startsWith("#") && line.trim().length > 0);

    for (const line of lines) {
      const chars = Array.from(line.trim());

      if (chars.length >= 2) {
        // Use the first character as the standard form
        const standardChar = chars[0];

        // Map each similar character to the standard character
        for (let i = 1; i < chars.length; i++) {
          directMap.set(chars[i], standardChar);
        }
      }
    }

    // Add additional mappings for accented characters
    const accentMap = new Map<string, string>([
      ["à", "a"],
      ["á", "a"],
      ["â", "a"],
      ["ã", "a"],
      ["ä", "a"],
      ["å", "a"],
      ["æ", "a"],
      ["ç", "c"],
      ["è", "e"],
      ["é", "e"],
      ["ê", "e"],
      ["ë", "e"],
      ["ì", "i"],
      ["í", "i"],
      ["î", "i"],
      ["ï", "i"],
      ["ı", "i"],
      ["ĩ", "i"],
      ["į", "i"],
      ["ɨ", "i"],
      ["ḯ", "i"],
      ["ỉ", "i"],
      ["ȉ", "i"],
      ["ȋ", "i"],
      ["ị", "i"],
      ["ḭ", "i"],
      ["ĳ", "i"],
      ["ñ", "n"],
      ["ò", "o"],
      ["ó", "o"],
      ["ô", "o"],
      ["õ", "o"],
      ["ö", "o"],
      ["ø", "o"],
      ["œ", "o"],
      ["ù", "u"],
      ["ú", "u"],
      ["û", "u"],
      ["ü", "u"],
      ["ý", "y"],
      ["ÿ", "y"],
      ["š", "s"],
      ["ž", "z"],
      ["ð", "d"],
      ["þ", "t"],
      ["ß", "s"],
      // Add more mappings as needed
    ]);

    // Merge the accent map with the direct map
    accentMap.forEach((value, key) => directMap.set(key, value));

    homoglyphMap = directMap;
    Logger.info(
      `Loaded ${swearWordsList.length} swear words and ${homoglyphMap.size} homoglyph characters`,
    );
  } catch (error) {
    Logger.error("Error loading homoglyphs:", error);
  }
}

(async function loadAllData() {
  try {
    await Promise.all([loadSwearWords(), loadHomoglyphs()]);
    Logger.info(
      `Loaded ${swearWordsList.length} swear words and ${homoglyphMap.size} homoglyph characters`,
    );
  } catch (error) {
    Logger.error("Error loading data:", error);
  }
})();

function normalizeUnicode(input: string): string {
  // Normalize Unicode characters to their base forms
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function containsProfaneWords(input: string): boolean {
  if (!input) return false;

  // Log the original query
  Logger.info(`Checking query: ${input}`);

  // Normalize input to handle accented characters
  const normalizedInput = normalizeUnicode(input.toLowerCase());

  // Check the original input
  for (let word of swearWordsList) {
    if (word && normalizedInput.includes(word)) {
      Logger.warn(`Profane word detected in query: ${input}`);
      return true;
    }
  }

  // Create a normalized version by replacing homoglyphs with standard characters
  let normalizedWithHomoglyphs = "";

  // For each character in the input
  for (const char of normalizedInput) {
    // If this character has a standard form, use it
    if (homoglyphMap.has(char)) {
      normalizedWithHomoglyphs += homoglyphMap.get(char);
    } else {
      // Otherwise keep the original character
      normalizedWithHomoglyphs += char;
    }
  }

  // Check the normalized version against the swear words list
  for (let word of swearWordsList) {
    if (word && normalizedWithHomoglyphs.includes(word)) {
      Logger.warn(
        `Profane word detected in normalized query: ${normalizedWithHomoglyphs}`,
      );
      return true;
    }
  }

  return false;
}

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
    // Always defer the reply immediately
    await interaction.deferReply().catch((error) => {
      Logger.error("Failed to defer reply:", error);
      return;
    });

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "search") {
      try {
        await handleImageSearch(interaction);
      } catch (error) {
        Logger.error("Error in image search command:", error);
        await interaction
          .editReply({
            content: "An error occurred while processing your request.",
          })
          .catch((e) => Logger.error("Failed to send error message:", e));
      }
    } else {
      await interaction
        .editReply({
          content: "Unknown subcommand",
        })
        .catch((e) =>
          Logger.error("Failed to send unknown subcommand message:", e),
        );
    }
  },
};

async function handleImageSearch(interaction: ChatInputCommandInteraction) {
  try {
    const query = interaction.options.getString("query", true);
    const language = interaction.options.getString("language") || "en";
    let currentPage = 0;

    // Log the query
    Logger.info(`Processing image search query: ${query}`);

    if (containsProfaneWords(query)) {
      await interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Your search query contains inappropriate content.",
              ),
          ],
        })
        .catch((error) => {
          Logger.error("Failed to send profanity warning:", error);
        });
      return;
    }

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
      await interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ No images found for your search."),
          ],
        })
        .catch((error) => {
          Logger.error("Failed to send no images found message:", error);
        });
      return;
    }

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
          iconURL: "https://cdn.discordapp.com/emojis/773481553690900736.png",
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

    const sendInitialEmbed = async () => {
      const embed = createEmbed(currentPage);
      const buttons = createButtons(currentPage);

      const message = await interaction.editReply({
        embeds: [embed],
        components: [buttons],
      });

      const filter = (i: any) =>
        i.user.id === interaction.user.id &&
        i.componentType === ComponentType.Button;

      const collector = message.createMessageComponentCollector({
        filter,
        time: 30000, // 30 seconds timeout
      });

      collector.on("collect", async (i: any) => {
        if (i.customId === "image_next") {
          currentPage = Math.min(currentPage + 1, data.images.length - 1);
        } else if (i.customId === "image_prev") {
          currentPage = Math.max(currentPage - 1, 0);
        } else if (i.customId === "image_first") {
          currentPage = 0;
        } else if (i.customId === "image_last") {
          currentPage = data.images.length - 1;
        }

        await i.update({
          embeds: [createEmbed(currentPage)],
          components: [createButtons(currentPage)],
        });
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time") {
          Logger.info("Component collector ended due to timeout.");
        }
      });
    };

    await sendInitialEmbed();
  } catch (error) {
    Logger.error("Error in image search:", error);
    await interaction
      .editReply({
        content: "An error occurred while processing your request.",
      })
      .catch((e) => Logger.error("Failed to send error message:", e));
  }
}
