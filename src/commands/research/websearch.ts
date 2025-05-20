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
import { searchDuckDuckGo, SearchResult } from "../../utils/searchInternet";

const detector = new ProfaneDetect();

// Decode both URL-encoded strings and HTML entities
function decodeText(text: string): string {
    // First decode URL encoding
    text = decodeURIComponent(text);

    // Then decode HTML entities
    return text
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, "\"")
        .replace(/&ldquo;/g, "\"")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&ndash;/g, "–")
        .replace(/&mdash;/g, "—")
        .replace(/&trade;/g, "™")
        .replace(/&copy;/g, "©")
        .replace(/&reg;/g, "®")
        .replace(/&#x([0-9a-f]+);/gi, (_match: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_match: string, dec: string) => String.fromCharCode(parseInt(dec, 10)));
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("websearch")
        .setDMPermission(true)
        .setDescription(
            "🔍 Search the internet (via DuckDuckGo, fuck you Google! fuck you Bing!)",
        )
        .addStringOption((opt) =>
            opt
                .setName("query")
                .setDescription("Your search query")
                .setRequired(true),
        )
        .addIntegerOption((opt) =>
            opt
                .setName("limit")
                .setDescription("Max results to fetch (1–50, for paging)")
                .setMinValue(1)
                .setMaxValue(50),
        ),

    prefix: {
        aliases: ["websearch", "duckduckgo", "web"],
        usage: "<query> [limit]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        // 1) Parse query and limit
        let query: string;
        let fetchLimit = 10;
        if (isPrefix) {
            const msg = interaction as Message;
            const parts = msg.content.trim().split(/\s+/).slice(1);
            if (!parts[0])
                return msg.reply(
                    `Usage: \`${this.prefix.aliases[0]} ${this.prefix.usage}\``,
                );
            query = parts[0];
            if (parts[1] && !isNaN(Number(parts[1]))) {
                fetchLimit = Math.min(Math.max(parseInt(parts[1], 10), 1), 50);
            }
        } else {
            const slash = interaction as ChatInputCommandInteraction;
            query = slash.options.getString("query", true);
            fetchLimit = slash.options.getInteger("limit") ?? 10;
            await slash.deferReply();
        }

        // 2) Profanity guard
        if (detector.detect(query).found) {
            const warning = new EmbedBuilder()
                .setColor("#ff3838")
                .setTitle("⚠️ Content Warning")
                .setDescription(
                    "Your search query has been flagged for inappropriate content.\nPlease revise and try again.",
                )
                .setTimestamp();
            return isPrefix
                ? (interaction as Message).reply({ embeds: [warning] })
                : (interaction as ChatInputCommandInteraction).reply({
                      embeds: [warning],
                      ephemeral: true,
                  });
        }

        // 3) Fetch results
        let allResults: SearchResult[];
        try {
            allResults = await searchDuckDuckGo(query, fetchLimit);
        } catch (err) {
            const errMsg = `❌ Search failed: ${(err as Error).message}`;
            return isPrefix
                ? (interaction as Message).reply(errMsg)
                : (interaction as ChatInputCommandInteraction).editReply({
                      content: errMsg,
                  });
        }
        if (allResults.length === 0) {
            const none = `❓ No results found for: \`${query}\``;
            return isPrefix
                ? (interaction as Message).reply(none)
                : (interaction as ChatInputCommandInteraction).editReply({
                      content: none,
                  });
        }

        // 4) Pagination state
        let page = 0;
        const totalPages = allResults.length;

        // 5) Build embed for current page
        const makeEmbed = (): EmbedBuilder => {
            const { title: rawTitle, url, description } = allResults[page];
            const title = decodeText(rawTitle);
            const link = decodeText(url);
            const decodedDescription = decodeText(description);
            return new EmbedBuilder()
                .setDescription(
                    `🔗 [${title}](${link}) (Page ${page + 1}/${totalPages})\n\n${decodedDescription}`,
                )
                .setTimestamp();
        };

        // 6) Build navigation buttons
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

        // 7) Send or edit message, fetch the sent Message
        let replyMsg: Message;
        if (isPrefix) {
            replyMsg = await (interaction as Message).reply({
                embeds: [makeEmbed()],
                components: [makeRow()],
                fetchReply: true,
            });
        } else {
            replyMsg = await (
                interaction as ChatInputCommandInteraction
            ).editReply({
                embeds: [makeEmbed()],
                components: [makeRow()],
                fetchReply: true,
            });
        }

        // 8) Create collector with filter
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
            const disabled =
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    makeRow().components.map((b) => b.setDisabled(true)),
                );
            replyMsg.edit({ components: [disabled] }).catch(() => null);
        });
    },
};
