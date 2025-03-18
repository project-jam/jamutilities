import {
  ChatInputCommandInteraction,
  Message,
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

function normalizeLanguageName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchLanguage(input: string): string | null {
  const normalizedInput = normalizeLanguageName(input);

  // Direct match for language codes
  if (languages[normalizedInput as keyof typeof languages]) {
    return normalizedInput;
  }

  // Check for full language names
  for (const [code, lang] of Object.entries(languages)) {
    if (normalizeLanguageName(lang.name) === normalizedInput) {
      return code;
    }
  }

  return null;
}

function getLanguagesDisplay(): string {
  return Object.entries(languages)
    .map(([code, { name, emoji }]) => `${emoji} \`${code}\` - ${name}`)
    .join("\n");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate text to different languages")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("The text to translate")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("to")
        .setDescription("Target language")
        .setRequired(true)
        .addChoices(
          ...Object.entries(languages).map(([code, { name }]) => ({
            name,
            value: code,
          })),
        ),
    ),

  prefix: {
    aliases: ["translate", "tr", "tl"],
    usage: "<language/code> <text>",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      if (isPrefix) {
        const message = interaction as Message;
        const args = message.content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/);

        args.shift(); // Remove command name

        if (args.length < 2) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ Please provide both a language and text to translate!",
                )
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}translate <language/code> <text>`,
                    `${process.env.PREFIX || "jam!"}tr <language/code> <text>`,
                    "",
                    "Available Languages:",
                    getLanguagesDisplay(),
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}tr japanese Hello, how are you?`,
                    `${process.env.PREFIX || "jam!"}translate english こんにちは`,
                    `${process.env.PREFIX || "jam!"}tl fr What's your name?`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        const targetLangInput = args[0];
        const textToTranslate = args.slice(1).join(" ");

        const targetLang = matchLanguage(targetLangInput);

        if (!targetLang) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ Invalid language! You can use either the language code or full name.",
                )
                .addFields({
                  name: "Available Languages",
                  value: getLanguagesDisplay(),
                }),
            ],
          });
          return;
        }

        await handleTranslation(message, textToTranslate, targetLang);
      } else {
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();

        const text = slashInteraction.options.getString("text", true);
        const targetLang = slashInteraction.options.getString("to", true);

        await handleTranslation(slashInteraction, text, targetLang);
      }
    } catch (error) {
      Logger.error("Translation command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Failed to translate the text. Please try again later.",
        );

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

async function handleTranslation(
  interaction: ChatInputCommandInteraction | Message,
  text: string,
  targetLang: string,
) {
  try {
    // Add typing indicator for prefix commands
    if (interaction instanceof Message) {
      await interaction.channel.sendTyping();
    }

    const response = await fetch(
      `https://api.project-jam.is-a.dev/api/v0/translate?text=${encodeURIComponent(text)}&tl=${targetLang}`,
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const langInfo = languages[targetLang as keyof typeof languages];

    const sourceCode = data.src.toLowerCase();
    const sourceLangInfo = languages[sourceCode as keyof typeof languages];

    const embed = new EmbedBuilder()
      .setColor("#00AE86")
      .setTitle(`${langInfo.emoji} Translation to ${langInfo.name}`)
      .addFields(
        {
          name: "Original Text",
          value: text,
          inline: false,
        },
        {
          name: "Translated Text",
          value: data.sentences[0].trans,
          inline: false,
        },
        {
          name: "Source Language",
          value: sourceLangInfo
            ? `${sourceLangInfo.emoji} ${sourceLangInfo.name}`
            : `🌐 ${sourceCode.toUpperCase()}`,
          inline: true,
        },
        {
          name: "Target Language",
          value: `${langInfo.emoji} ${langInfo.name}`,
          inline: true,
        },
      )
      .setFooter({
        text: `Requested by ${interaction instanceof Message ? interaction.author.tag : interaction.user.tag}`,
        iconURL:
          interaction instanceof Message
            ? interaction.author.displayAvatarURL()
            : interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    if (interaction instanceof Message) {
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    Logger.error("Translation failed:", error);
    throw error;
  }
}
