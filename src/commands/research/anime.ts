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

interface AnimeResponse {
    data: AnimeResult[];
    pagination: {
        last_visible_page: number;
        has_next_page: boolean;
        current_page: number;
    };
}

interface AnimeResult {
    mal_id: number;
    url: string;
    images: {
        jpg: {
            image_url: string;
            large_image_url: string;
        };
    };
    trailer: {
        url: string | null;
        embed_url: string | null;
    };
    title: string;
    title_english: string | null;
    title_japanese: string | null;
    type: string | null;
    source: string;
    episodes: number | null;
    status: string;
    airing: boolean;
    aired: {
        from: string | null;
        to: string | null;
        string: string;
    };
    duration: string;
    rating: string | null;
    score: number | null;
    scored_by: number | null;
    rank: number | null;
    popularity: number | null;
    members: number;
    favorites: number;
    synopsis: string | null;
    background: string | null;
    season: string | null;
    year: number | null;
    studios: Array<{
        mal_id: number;
        type: string;
        name: string;
        url: string;
    }>;
    genres: Array<{
        mal_id: number;
        type: string;
        name: string;
        url: string;
    }>;
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("anime")
        .setDescription("Get information about anime shows")
        .setDMPermission(true)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("search")
                .setDescription("Search for anime by title")
                .addStringOption((option) =>
                    option
                        .setName("title")
                        .setDescription("The title of the anime to search for")
                        .setRequired(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("random")
                .setDescription("Get a random anime recommendation"),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("top")
                .setDescription("Get the top anime list")
                .addStringOption((option) =>
                    option
                        .setName("type")
                        .setDescription("Type of anime to show")
                        .setRequired(false)
                        .addChoices(
                            { name: "TV Shows", value: "tv" },
                            { name: "Movies", value: "movie" },
                            { name: "OVAs", value: "ova" },
                            { name: "Specials", value: "special" },
                        ),
                ),
        ),

    prefix: {
        aliases: ["anime", "ani", "a"],
        usage: "<search/random/top> [query/type]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        if (isPrefix) {
            const message = interaction as Message;
            const args = message.content.trim().split(/ +/).slice(1);
            const subcommand = args[0]?.toLowerCase();

            if (!subcommand) {
                const prefix = process.env.PREFIX || "jam!";
                await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("❌ Please specify a subcommand!")
                            .addFields({
                                name: "Usage",
                                value: [
                                    `${prefix}anime search <title> - Search for an anime`,
                                    `${prefix}anime random - Get a random anime`,
                                    `${prefix}anime top [tv/movie/ova/special] - View top anime`,
                                ].join("\n"),
                                inline: false,
                            })
                            .addFields({
                                name: "Examples",
                                value: [
                                    `${prefix}anime search "One Piece"`,
                                    `${prefix}anime random`,
                                    `${prefix}anime top tv`,
                                ].join("\n"),
                                inline: false,
                            }),
                    ],
                });
                return;
            }

            await message.channel.sendTyping();

            switch (subcommand) {
                case "search": {
                    const title = args.slice(1).join(" ");
                    if (!title) {
                        await message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ Please provide an anime title to search for!",
                                    ),
                            ],
                        });
                        return;
                    }
                    await handleAnimeSearch(message, title);
                    break;
                }
                case "random":
                    await handleRandomAnime(message);
                    break;
                case "top": {
                    const type = args[1]?.toLowerCase();
                    if (
                        type &&
                        !["tv", "movie", "ova", "special"].includes(type)
                    ) {
                        await message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ Invalid type! Use: tv, movie, ova, or special",
                                    ),
                            ],
                        });
                        return;
                    }
                    await handleTopAnime(message, type);
                    break;
                }
                default:
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Invalid subcommand! Use: search, random, or top",
                                ),
                        ],
                    });
                    break;
            }
        } else {
            await (interaction as ChatInputCommandInteraction).deferReply();
            const subcommand = (
                interaction as ChatInputCommandInteraction
            ).options.getSubcommand();

            switch (subcommand) {
                case "search":
                    const title = (
                        interaction as ChatInputCommandInteraction
                    ).options.getString("title", true);
                    await handleAnimeSearch(interaction, title);
                    break;
                case "random":
                    await handleRandomAnime(interaction);
                    break;
                case "top":
                    const type = (
                        interaction as ChatInputCommandInteraction
                    ).options.getString("type");
                    await handleTopAnime(interaction, type);
                    break;
            }
        }
    },
};

async function handleAnimeSearch(
    interaction: ChatInputCommandInteraction | Message,
    title: string,
) {
    try {
        const response = await fetch(
            `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&sfw=true&limit=10`,
        );

        if (!response.ok) {
            throw new Error(`Jikan API returned ${response.status}`);
        }

        const data: AnimeResponse = await response.json();

        if (!data.data || data.data.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(`❌ No results found for "${title}"`);

            if (interaction instanceof Message) {
                await interaction.reply({ embeds: [errorEmbed] });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
            return;
        }

        await showPaginatedResults(interaction, data.data, "search");
    } catch (error) {
        Logger.error("Anime search failed:", error);
        const errorEmbed = new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
                "❌ Failed to search for anime. Please try again later.",
            );

        if (interaction instanceof Message) {
            await interaction.reply({ embeds: [errorEmbed] });
        } else {
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
}

async function handleRandomAnime(
    interaction: ChatInputCommandInteraction | Message,
) {
    try {
        const response = await fetch(
            "https://api.jikan.moe/v4/random/anime?sfw=true",
        );

        if (!response.ok) {
            throw new Error(`Jikan API returned ${response.status}`);
        }

        const data = await response.json();
        const anime = data.data;

        if (!anime) {
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ Failed to get a random anime. Please try again.",
                );

            if (interaction instanceof Message) {
                await interaction.reply({ embeds: [errorEmbed] });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
            return;
        }

        await showPaginatedResults(interaction, [anime], "search");
    } catch (error) {
        Logger.error("Random anime failed:", error);
        const errorEmbed = new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
                "❌ Failed to get random anime. Please try again later.",
            );

        if (interaction instanceof Message) {
            await interaction.reply({ embeds: [errorEmbed] });
        } else {
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
}

async function handleTopAnime(
    interaction: ChatInputCommandInteraction | Message,
    type: string | null,
) {
    try {
        let apiUrl = "https://api.jikan.moe/v4/top/anime?sfw=true&limit=10";
        if (type) {
            apiUrl += `&type=${type}`;
        }

        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Jikan API returned ${response.status}`);
        }

        const data: AnimeResponse = await response.json();

        if (!data.data || data.data.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Failed to fetch top anime list.");

            if (interaction instanceof Message) {
                await interaction.reply({ embeds: [errorEmbed] });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
            return;
        }

        await showPaginatedResults(interaction, data.data, "top");
    } catch (error) {
        Logger.error("Top anime failed:", error);
        const errorEmbed = new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
                "❌ Failed to fetch top anime. Please try again later.",
            );

        if (interaction instanceof Message) {
            await interaction.reply({ embeds: [errorEmbed] });
        } else {
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
}

async function showPaginatedResults(
    interaction: ChatInputCommandInteraction | Message,
    animeList: AnimeResult[],
    mode: "search" | "top",
) {
    let currentPage = 0;

    const createButtons = (page: number) => {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("prev")
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId("next")
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === animeList.length - 1),
        );
    };

    const message = await (interaction instanceof Message
        ? interaction.reply({
              embeds: [
                  createAnimeEmbed(
                      animeList[currentPage],
                      currentPage,
                      animeList.length,
                  ),
              ],
              components:
                  animeList.length > 1 ? [createButtons(currentPage)] : [],
              fetchReply: true,
          })
        : interaction.editReply({
              embeds: [
                  createAnimeEmbed(
                      animeList[currentPage],
                      currentPage,
                      animeList.length,
                  ),
              ],
              components:
                  animeList.length > 1 ? [createButtons(currentPage)] : [],
          }));

    if (animeList.length <= 1) return;

    const collector = (message as Message).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000,
    });

    collector.on("collect", async (i) => {
        if (
            i.user.id !==
            (interaction instanceof Message
                ? interaction.author.id
                : interaction.user.id)
        ) {
            await i.reply({
                content: "❌ These buttons aren't for you!",
                ephemeral: true,
            });
            return;
        }

        if (i.customId === "prev") {
            currentPage = Math.max(0, currentPage - 1);
        } else if (i.customId === "next") {
            currentPage = Math.min(animeList.length - 1, currentPage + 1);
        }

        await i.update({
            embeds: [
                createAnimeEmbed(
                    animeList[currentPage],
                    currentPage,
                    animeList.length,
                ),
            ],
            components: [createButtons(currentPage)],
        });
    });

    collector.on("end", () => {
        if (interaction instanceof Message) {
            message.edit({ components: [] }).catch(() => {});
        } else {
            interaction.editReply({ components: [] }).catch(() => {});
        }
    });
}

function createAnimeEmbed(
    anime: AnimeResult,
    currentPage: number,
    totalPages: number,
): EmbedBuilder {
    let synopsis = anime.synopsis || "No synopsis available.";
    if (synopsis.length > 2048) {
        synopsis = synopsis.substring(0, 2045) + "...";
    }

    const studios =
        anime.studios?.map((studio) => studio.name).join(", ") || "Unknown";
    const genres =
        anime.genres?.map((genre) => genre.name).join(", ") || "None";

    const embed = new EmbedBuilder()
        .setColor("#2E51A2")
        .setTitle(anime.title)
        .setURL(anime.url)
        .setDescription(
            anime.title_english
                ? `English: ${anime.title_english}`
                : "No English title available",
        );

    if (anime.images?.jpg?.image_url) {
        embed.setThumbnail(anime.images.jpg.image_url);
    }

    if (anime.score) {
        embed.addFields({
            name: "📊 Rating",
            value: `${anime.score}/10 ${anime.scored_by ? `(${anime.scored_by.toLocaleString()} votes)` : ""}`,
            inline: true,
        });
    }

    embed.addFields(
        {
            name: "📺 Type",
            value: `${anime.type || "Unknown"} • ${anime.episodes || "?"} episode(s)`,
            inline: true,
        },
        {
            name: "📆 Aired",
            value: anime.aired?.string || "Unknown",
            inline: true,
        },
    );

    // Split synopsis into chunks if needed
    const synopsisChunks = synopsis.match(/.{1,1024}/g) || [
        "No synopsis available.",
    ];
    synopsisChunks.forEach((chunk, index) => {
        embed.addFields({
            name: index === 0 ? "📝 Synopsis" : "📝 Synopsis (continued)",
            value: chunk,
        });
    });

    embed.addFields(
        {
            name: "🎭 Genres",
            value: genres,
            inline: true,
        },
        {
            name: "🎨 Studios",
            value: studios,
            inline: true,
        },
        {
            name: "📊 Status",
            value: anime.status || "Unknown",
            inline: true,
        },
    );

    embed.setFooter({
        text:
            totalPages > 1
                ? `Anime ${currentPage + 1}/${totalPages} • ${anime.rank ? `Rank #${anime.rank}` : "Unranked"}`
                : `${anime.rank ? `Rank #${anime.rank}` : "Unranked"} • ${anime.popularity ? `Popularity #${anime.popularity}` : ""}`,
    });

    if (anime.images?.jpg?.large_image_url) {
        embed.setImage(anime.images.jpg.large_image_url);
    }

    embed.setTimestamp();

    return embed;
}

async function sendAnimeEmbed(
    interaction: ChatInputCommandInteraction,
    anime: AnimeResult,
) {
    await interaction.editReply({
        embeds: [createAnimeEmbed(anime, 0, 1)],
    });
}
