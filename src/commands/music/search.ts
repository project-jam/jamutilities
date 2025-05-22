import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember,
    TextChannel,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { DistubeHandler } from "../../handlers/distubeHandler";
import axios from "axios";

// Define YouTube search result interface
interface YouTubeSearchResult {
    id: {
        videoId: string;
    };
    snippet: {
        title: string;
        channelTitle: string;
        description: string;
        publishedAt: string;
        thumbnails: {
            default: {
                url: string;
            };
            medium: {
                url: string;
            };
            high: {
                url: string;
            };
        };
    };
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("search")
        .setDescription(
            "Searches for YouTube videos and lets you select one to play.",
        )
        .addStringOption((option) =>
            option
                .setName("query")
                .setDescription("The search query for YouTube videos")
                .setRequired(true),
        ),

    prefix: {
        aliases: ["search", "find"],
        usage: "<search query>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let query: string;
            let member: GuildMember;
            let textChannel: TextChannel;

            const distube = DistubeHandler.getInstance(
                interaction.client,
            ).distube;

            if (isPrefix) {
                const message = interaction as Message;

                if (!message.guild) {
                    await message.reply(
                        "This command can only be used in a server!",
                    );
                    return;
                }
                if (!message.member) {
                    await message.reply(
                        "Could not identify you as a member of this server.",
                    );
                    return;
                }
                member = message.member;
                textChannel = message.channel as TextChannel;

                const args = message.content.trim().split(/ +/).slice(1);
                if (!args.length) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Please provide a search query!",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: `${process.env.PREFIX || "jam!"}search <search query>`,
                                }),
                        ],
                    });
                    return;
                }

                query = args.join(" ").trim();

                if (!member.voice.channel) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to search and play music!",
                                ),
                        ],
                    });
                    return;
                }

                const statusMessage = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🔍 Searching YouTube for \`${query}\`... Please wait...`,
                            ),
                    ],
                });

                try {
                    const searchResults = await searchYouTube(query);

                    if (!searchResults.length) {
                        await statusMessage.edit({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ No results found for \`${query}\`. Try a different search term.`,
                                    ),
                            ],
                        });
                        return;
                    }

                    // Create select menu for search results
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`youtube_search_${message.id}`)
                        .setPlaceholder("Select a video to play")
                        .addOptions(
                            searchResults.map((result, index) => ({
                                label: truncateString(
                                    result.snippet.title,
                                    100,
                                ),
                                description: truncateString(
                                    `By ${result.snippet.channelTitle}`,
                                    100,
                                ),
                                value: `${index}`,
                            })),
                        );

                    const row =
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                            selectMenu,
                        );

                    // Create a list of search results in the embed description
                    const resultsList = searchResults
                        .map(
                            (result, index) =>
                                `**${index + 1}.** [${result.snippet.title}](https://www.youtube.com/watch?v=${result.id.videoId}) - ${result.snippet.channelTitle}`,
                        )
                        .join("\n");

                    const selectMessage = await statusMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#4f74c8")
                                .setTitle("YouTube Search Results")
                                .setDescription(
                                    `Found ${searchResults.length} results for \`${query}\`:\n\n${resultsList}\n\nSelect one to play from the dropdown below:`,
                                )
                                .setFooter({
                                    text: "Selection expires in 30 seconds",
                                }),
                        ],
                        components: [row],
                    });

                    // Create component collector
                    const collector =
                        selectMessage.createMessageComponentCollector({
                            componentType: ComponentType.StringSelect,
                            time: 30000,
                        });

                    collector.on(
                        "collect",
                        async (
                            selectInteraction: StringSelectMenuInteraction,
                        ) => {
                            // Only let the original user interact with the menu
                            if (
                                selectInteraction.user.id !== message.author.id
                            ) {
                                await selectInteraction.reply({
                                    content:
                                        "You cannot use this selection menu as you didn't initiate the search.",
                                    ephemeral: true,
                                });
                                return;
                            }

                            const selectedIndex = parseInt(
                                selectInteraction.values[0],
                            );
                            const selectedVideo = searchResults[selectedIndex];
                            const videoUrl = `https://www.youtube.com/watch?v=${selectedVideo.id.videoId}`;

                            await selectInteraction.update({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("#4f74c8")
                                        .setTitle("Playing Selected Video")
                                        .setDescription(
                                            `🎵 Now playing: **${selectedVideo.snippet.title}**\nBy: ${selectedVideo.snippet.channelTitle}`,
                                        )
                                        .setThumbnail(
                                            selectedVideo.snippet.thumbnails
                                                .default.url,
                                        )
                                        .setURL(videoUrl), // Add clickable URL in the embed title
                                ],
                                components: [],
                            });

                            // Play the selected song using DisTube
                            try {
                                await distube.play(
                                    member.voice.channel,
                                    videoUrl,
                                    {
                                        member: member,
                                        textChannel: textChannel,
                                    },
                                );
                            } catch (error: any) {
                                Logger.error(
                                    "Error playing selected video:",
                                    error,
                                );
                                await selectMessage.edit({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor("#ff3838")
                                            .setDescription(
                                                `❌ Error playing the selected video: ${error.message || "Unknown error"}.`,
                                            ),
                                    ],
                                    components: [],
                                });
                            }

                            collector.stop();
                        },
                    );

                    collector.on("end", async (collected) => {
                        if (collected.size === 0) {
                            await selectMessage.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("#ff3838")
                                        .setDescription(
                                            "❌ Search selection timed out. Please try searching again.",
                                        ),
                                ],
                                components: [],
                            });
                        }
                    });
                } catch (error: any) {
                    Logger.error("Error in YouTube search (prefix):", error);
                    await statusMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error searching YouTube: ${error.message || "Unknown error"}.`,
                                ),
                        ],
                    });
                }
            } else {
                // Handle slash command
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;

                if (!slashInteraction.guild) {
                    const replyMethod =
                        slashInteraction.deferred || slashInteraction.replied
                            ? slashInteraction.editReply
                            : slashInteraction.reply;
                    await replyMethod.call(slashInteraction, {
                        content: "This command can only be used in a server!",
                        ephemeral: true,
                    });
                    return;
                }
                if (!slashInteraction.channel) {
                    const replyMethod =
                        slashInteraction.deferred || slashInteraction.replied
                            ? slashInteraction.editReply
                            : slashInteraction.reply;
                    await replyMethod.call(slashInteraction, {
                        content:
                            "Could not determine the channel for this command.",
                        ephemeral: true,
                    });
                    return;
                }
                textChannel = slashInteraction.channel as TextChannel;

                await slashInteraction.deferReply();
                member = slashInteraction.member as GuildMember;

                if (!member.voice.channel) {
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to search and play music!",
                                ),
                        ],
                    });
                    return;
                }

                query = slashInteraction.options
                    .getString("query", true)
                    .trim();

                await slashInteraction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🔍 Searching YouTube for \`${query}\`... Please wait...`,
                            ),
                    ],
                });

                try {
                    const searchResults = await searchYouTube(query);

                    if (!searchResults.length) {
                        await slashInteraction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ No results found for \`${query}\`. Try a different search term.`,
                                    ),
                            ],
                        });
                        return;
                    }

                    // Create select menu for search results
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`youtube_search_${slashInteraction.id}`)
                        .setPlaceholder("Select a video to play")
                        .addOptions(
                            searchResults.map((result, index) => ({
                                label: truncateString(
                                    result.snippet.title,
                                    100,
                                ),
                                description: truncateString(
                                    `By ${result.snippet.channelTitle}`,
                                    100,
                                ),
                                value: `${index}`,
                            })),
                        );

                    const row =
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                            selectMenu,
                        );

                    // Create a list of search results in the embed description
                    const resultsList = searchResults
                        .map(
                            (result, index) =>
                                `**${index + 1}.** [${result.snippet.title}](https://www.youtube.com/watch?v=${result.id.videoId}) - ${result.snippet.channelTitle}`,
                        )
                        .join("\n");

                    const message = await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#4f74c8")
                                .setTitle("YouTube Search Results")
                                .setDescription(
                                    `Found ${searchResults.length} results for \`${query}\`:\n\n${resultsList}\n\nSelect one to play from the dropdown below:`,
                                )
                                .setFooter({
                                    text: "Selection expires in 30 seconds",
                                }),
                        ],
                        components: [row],
                    });

                    // Create component collector
                    const collector = (
                        await message
                    ).createMessageComponentCollector({
                        componentType: ComponentType.StringSelect,
                        time: 30000,
                    });

                    collector.on(
                        "collect",
                        async (
                            selectInteraction: StringSelectMenuInteraction,
                        ) => {
                            // Only let the original user interact with the menu
                            if (
                                selectInteraction.user.id !==
                                slashInteraction.user.id
                            ) {
                                await selectInteraction.reply({
                                    content:
                                        "You cannot use this selection menu as you didn't initiate the search.",
                                    ephemeral: true,
                                });
                                return;
                            }

                            const selectedIndex = parseInt(
                                selectInteraction.values[0],
                            );
                            const selectedVideo = searchResults[selectedIndex];
                            const videoUrl = `https://www.youtube.com/watch?v=${selectedVideo.id.videoId}`;

                            await selectInteraction.update({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("#4f74c8")
                                        .setTitle("Playing Selected Video")
                                        .setDescription(
                                            `🎵 Now playing: **${selectedVideo.snippet.title}**\nBy: ${selectedVideo.snippet.channelTitle}`,
                                        )
                                        .setThumbnail(
                                            selectedVideo.snippet.thumbnails
                                                .default.url,
                                        )
                                        .setURL(videoUrl), // Add clickable URL in the embed title
                                ],
                                components: [],
                            });

                            // Play the selected song using DisTube
                            try {
                                await distube.play(
                                    member.voice.channel,
                                    videoUrl,
                                    {
                                        member: member,
                                        textChannel: textChannel,
                                    },
                                );
                            } catch (error: any) {
                                Logger.error(
                                    "Error playing selected video:",
                                    error,
                                );
                                await slashInteraction.editReply({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor("#ff3838")
                                            .setDescription(
                                                `❌ Error playing the selected video: ${error.message || "Unknown error"}.`,
                                            ),
                                    ],
                                    components: [],
                                });
                            }

                            collector.stop();
                        },
                    );

                    collector.on("end", async (collected) => {
                        if (collected.size === 0) {
                            await slashInteraction.editReply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("#ff3838")
                                        .setDescription(
                                            "❌ Search selection timed out. Please try searching again.",
                                        ),
                                ],
                                components: [],
                            });
                        }
                    });
                } catch (error: any) {
                    Logger.error("Error in YouTube search (slash):", error);
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error searching YouTube: ${error.message || "Unknown error"}.`,
                                ),
                        ],
                    });
                }
            }
        } catch (error: any) {
            Logger.error("General error in search command:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An unexpected error occurred while searching. Please try again.",
                );

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                if (slashInteraction.replied || slashInteraction.deferred) {
                    await slashInteraction.editReply({ embeds: [errorEmbed] });
                } else {
                    await slashInteraction.reply({
                        embeds: [errorEmbed],
                        ephemeral: true,
                    });
                }
            }
        }
    },
};

// Helper function to search YouTube
async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
    try {
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            throw new Error("YouTube API key is not configured");
        }

        const response = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
                params: {
                    part: "snippet",
                    maxResults: 10,
                    q: query,
                    type: "video",
                    key: apiKey,
                    videoCategoryId: "10", // Music category
                    videoEmbeddable: true, // Only return embeddable videos
                    videoSyndicated: true, // Only return videos that can be played outside youtube.com
                },
            },
        );

        if (response.data.items && Array.isArray(response.data.items)) {
            return response.data.items as YouTubeSearchResult[];
        }

        return [];
    } catch (error) {
        Logger.error("YouTube API error:", error);
        throw new Error("Failed to search YouTube");
    }
}

// Helper function to truncate strings for select menu options
function truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
}
