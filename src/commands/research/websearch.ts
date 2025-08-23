import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { ProfaneDetect } from "@projectjam/profane-detect";
import { searchInternet, SearchResult } from "../../utils/searchInternet";

const detector = new ProfaneDetect();

// Decode URL and HTML entities
function decodeText(text: string): string {
  text = decodeURIComponent(text);
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&trade;/g, "™")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec) =>
      String.fromCharCode(parseInt(dec, 10)),
    );
}

const LANGUAGES = [
  { name: "English", value: "en" },
  { name: "Japanese", value: "jp" },
  { name: "Chinese (Simplified)", value: "zh-cn" },
  { name: "Chinese (Traditional)", value: "zh-tw" },
  { name: "French", value: "fr" },
  { name: "German", value: "de" },
  { name: "Spanish", value: "es" },
  { name: "Italian", value: "it" },
  { name: "Korean", value: "ko" },
  { name: "Portuguese", value: "pt" },
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("websearch")
    .setDescription("🔍 Search the internet (via JamAPI, fuck Bing!)")
    .setDMPermission(true)
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Your search query")
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("Max results to fetch (1–50)")
        .setMinValue(1)
        .setMaxValue(50),
    )
    .addStringOption((opt) =>
      opt
        .setName("language")
        .setDescription("Search language")
        .setRequired(false)
        .addChoices(...LANGUAGES),
    ),

  prefix: {
    aliases: ["websearch", "google", "web"],
    usage: "<query> [--limit=10] [--lang=en]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    let query: string;
    let limit = 10;
    let lang = "en";

    if (isPrefix) {
      const msg = interaction as Message;
      const parts = msg.content.split(/\s+/).slice(1);

      // ✅ collect all words not starting with --
      const queryParts = parts.filter((p) => !p.startsWith("--"));
      query = queryParts.join(" ").trim();

      const limitArg = parts.find((p) => p.startsWith("--limit="));
      if (limitArg)
        limit = Math.min(
          Math.max(parseInt(limitArg.split("=")[1], 10), 1),
          50,
        );

      const langArg = parts.find((p) => p.startsWith("--lang="));
      if (langArg) lang = langArg.split("=")[1];
    } else {
      const slash = interaction as ChatInputCommandInteraction;
      query = slash.options.getString("query", true);
      limit = slash.options.getInteger("limit") ?? 10;
      lang = slash.options.getString("language") ?? "en";
      await slash.deferReply();
    }

    if (!query) return;

    // Profanity check
    if (detector.detect(query).found) {
      const warning = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("⚠️ Content Warning")
        .setDescription(
          "Your search query is flagged for inappropriate content. Revise and try again.",
        )
        .setTimestamp();
      return isPrefix
        ? (interaction as Message).reply({ embeds: [warning] })
        : (interaction as ChatInputCommandInteraction).reply({
            embeds: [warning],
            ephemeral: true,
          });
    }

    // Fetch results
    let results: SearchResult[];
    let suggestion: string | null = null;
    try {
      const data = await searchInternet(query, lang, limit);
      results = data["result-contents"];
      suggestion = data.suggestion;
    } catch (err) {
      const errMsg = `❌ Search failed: ${(err as Error).message}`;
      return isPrefix
        ? (interaction as Message).reply(errMsg)
        : (interaction as ChatInputCommandInteraction).editReply({
            content: errMsg,
          });
    }

    if (results.length === 0) {
      const none = `❓ No results found for: \`${query}\``;
      return isPrefix
        ? (interaction as Message).reply(none)
        : (interaction as ChatInputCommandInteraction).editReply({
            content: none,
          });
    }

    // Pagination
    let page = 0;
    const totalPages = results.length;

    const makeEmbed = (): EmbedBuilder => {
      const { title: rawTitle, url, description } = results[page];
      const title = decodeText(rawTitle);
      const link = decodeText(url);
      const desc = decodeText(description);
      return new EmbedBuilder()
        .setDescription(
          `🔗 [${title}](${link}) (Page ${page + 1}/${totalPages})\n\n${desc}`,
        )
        .setFooter({
          text: suggestion
            ? `Did you mean: ${suggestion}`
            : `Requested by ${
                isPrefix
                  ? (interaction as Message).author.username
                  : (interaction as ChatInputCommandInteraction).user.username
              } | Language: ${
                LANGUAGES.find((l) => l.value === lang)?.name ?? lang
              }`,
        })
        .setTimestamp();
    };

    const makeRow = () =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("⬅️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ➡️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages - 1),
      );

    let replyMsg: Message;
    if (isPrefix) {
      replyMsg = await (interaction as Message).reply({
        embeds: [makeEmbed()],
        components: [makeRow()],
        fetchReply: true,
      });
    } else {
      replyMsg = await (interaction as ChatInputCommandInteraction).editReply({
        embeds: [makeEmbed()],
        components: [makeRow()],
        fetchReply: true,
      });
    }

    const userId = isPrefix
      ? (interaction as Message).author.id
      : (interaction as ChatInputCommandInteraction).user.id;
    const collector = replyMsg.createMessageComponentCollector({
      filter: (btn: ButtonInteraction) => btn.user.id === userId,
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on("collect", async (btn: ButtonInteraction) => {
      if (btn.customId === "prev" && page > 0) page--;
      if (btn.customId === "next" && page < totalPages - 1) page++;
      await btn.update({
        embeds: [makeEmbed()],
        components: [makeRow()],
      });
    });

    collector.on("end", () => {
      const disabled = new ActionRowBuilder<ButtonBuilder>().addComponents(
        makeRow().components.map((b) => b.setDisabled(true)),
      );
      replyMsg.edit({ components: [disabled] }).catch(() => null);
    });
  },
};

