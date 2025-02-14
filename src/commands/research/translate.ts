import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface TranslationResponse {
  sentences: {
    trans: string;
    orig: string;
    backend: number;
  }[];
  src: string;
  confidence: number;
}

// Language configurations with emojis and full names
const languages = {
  en: { name: "English", emoji: "🇬🇧" },
  es: { name: "Spanish", emoji: "🇪🇸" },
  fr: { name: "French", emoji: "🇫🇷" },
  de: { name: "German", emoji: "🇩🇪" },
  it: { name: "Italian", emoji: "🇮🇹" },
  ja: { name: "Japanese", emoji: "🇯🇵" },
  ko: { name: "Korean", emoji: "🇰🇷" },
  zh: { name: "Chinese", emoji: "🇨🇳" },
  ru: { name: "Russian", emoji: "🇷🇺" },
  pt: { name: "Portuguese", emoji: "🇵🇹" },
  ar: { name: "Arabic", emoji: "🇸🇦" },
  hi: { name: "Hindi", emoji: "🇮🇳" },
  tr: { name: "Turkish", emoji: "🇹🇷" },
  nl: { name: "Dutch", emoji: "🇳🇱" },
  pl: { name: "Polish", emoji: "🇵🇱" },
  vi: { name: "Vietnamese", emoji: "🇻🇳" },
  th: { name: "Thai", emoji: "🇹🇭" },
  sv: { name: "Swedish", emoji: "🇸🇪" },
  da: { name: "Danish", emoji: "🇩🇰" },
  fi: { name: "Finnish", emoji: "🇫🇮" },
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate text to different languages")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("en")
        .setDescription("Translate to English")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("fr")
        .setDescription("Translate to French")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ja")
        .setDescription("Translate to Japanese")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("es")
        .setDescription("Translate to Spanish")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("de")
        .setDescription("Translate to German")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ko")
        .setDescription("Translate to Korean")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("zh")
        .setDescription("Translate to Chinese")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ru")
        .setDescription("Translate to Russian")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to translate")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const targetLang = interaction.options.getSubcommand();
      const textToTranslate = interaction.options.getString("text", true);

      // Encode the text for URL
      const encodedText = encodeURIComponent(textToTranslate);

      // Make request to Project Jam API
      const response = await fetch(
        `https://api.project-jam.is-a.dev/api/v0/translate?text=${encodedText}&tl=${targetLang}`,
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: TranslationResponse = await response.json();
      const langInfo = languages[targetLang as keyof typeof languages];

      // Create embed with translation
      const embed = new EmbedBuilder()
        .setColor("#00AE86")
        .setTitle(`${langInfo.emoji} Translation to ${langInfo.name}`)
        .addFields(
          {
            name: "Original Text",
            value: data.sentences[0].orig || textToTranslate,
            inline: false,
          },
          {
            name: "Translated Text",
            value: data.sentences[0].trans,
            inline: false,
          },
          {
            name: "Source Language",
            value: `${languages[data.src as keyof typeof languages]?.emoji || "🌐"} ${data.src.toUpperCase()}`,
            inline: true,
          },
          {
            name: "Target Language",
            value: `${langInfo.emoji} ${targetLang.toUpperCase()}`,
            inline: true,
          },
        )
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Translation failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to translate the text. Please try again later.",
            ),
        ],
      });
    }
  },
};
