////////////////////////////////////////////////////////////////////
///// WARNING: This file is not being used in the project.     /////
///// If you want to use it, you need to import it in index.ts /////
///// Even tho it's a command, don't run it.                   /////
///// As this file is not being used, it is not being tested.  /////
///// It may or may not work as expected.                      /////
///// And it may crash the bot.                                /////
///// You have been warned.                                    /////
////////////////////////////////////////////////////////////////////

import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { DisTube } from "distube";
import { YtDlpPlugin } from "@distube/yt-dlp";
import { Logger } from "../utils/logger";

let instance: DistubeHandler | null = null;

export class DistubeHandler {
    public distube: DisTube;
    private client: Client;

    private constructor(client: Client) {
        this.client = client;

        // Initialize DisTube with minimal options to avoid compatibility issues
        this.distube = new DisTube(client, {
            plugins: [new YtDlpPlugin({ update: false })],
        });

        // Set up event listeners
        this.setupEventListeners();

        Logger.info("DisTube handler initialized");
    }

    // Singleton pattern
    public static getInstance(client: Client): DistubeHandler {
        if (!instance) {
            instance = new DistubeHandler(client);
        }
        return instance;
    }

    private setupEventListeners(): void {
        // Play song event
        this.distube.on("playSong", (queue, song) => {
            try {
                const embed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle("🎵 Now Playing")
                    .setDescription(`[${song.name}](${song.url})`)
                    .addFields(
                        {
                            name: "Duration",
                            value: song.formattedDuration,
                            inline: true,
                        },
                        {
                            name: "Requested By",
                            value: song.user?.tag || "Unknown",
                            inline: true,
                        },
                    )
                    .setThumbnail(song.thumbnail || null)
                    .setTimestamp();

                const channel = queue.textChannel as TextChannel;
                if (channel && typeof channel.send === "function") {
                    channel.send({ embeds: [embed] }).catch((err) => {
                        Logger.error("Failed to send playSong message:", err);
                    });
                }
            } catch (error) {
                Logger.error("Error in playSong event:", error);
            }
        });

        // Add song event
        this.distube.on("addSong", (queue, song) => {
            try {
                const embed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle("🎵 Added to Queue")
                    .setDescription(`[${song.name}](${song.url})`)
                    .addFields(
                        {
                            name: "Duration",
                            value: song.formattedDuration,
                            inline: true,
                        },
                        {
                            name: "Requested By",
                            value: song.user?.tag || "Unknown",
                            inline: true,
                        },
                        {
                            name: "Position",
                            value: `${queue.songs.length}`,
                            inline: true,
                        },
                    )
                    .setThumbnail(song.thumbnail || null)
                    .setTimestamp();

                const channel = queue.textChannel as TextChannel;
                if (channel && typeof channel.send === "function") {
                    channel.send({ embeds: [embed] }).catch((err) => {
                        Logger.error("Failed to send addSong message:", err);
                    });
                }
            } catch (error) {
                Logger.error("Error in addSong event:", error);
            }
        });

        // Error event - with robust error handling
        this.distube.on("error", (channel, error) => {
            Logger.error(`DisTube error:`, error);

            try {
                // If channel is a valid Discord channel
                if (
                    channel &&
                    typeof channel === "object" &&
                    typeof channel.send === "function"
                ) {
                    channel
                        .send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setTitle("❌ Error")
                                    .setDescription(
                                        "An error occurred while playing music: " +
                                            (error?.message || "Unknown error"),
                                    )
                                    .setTimestamp(),
                            ],
                        })
                        .catch((e) =>
                            Logger.error("Failed to send error message:", e),
                        );
                } else {
                    // If channel is not valid, log it
                    Logger.warn(
                        "Received invalid channel in error event:",
                        typeof channel,
                    );

                    // Check if error contains a queue with a text channel
                    if (error && error.queue && error.queue.textChannel) {
                        try {
                            const textChannel = error.queue.textChannel;
                            if (
                                textChannel &&
                                typeof textChannel.send === "function"
                            ) {
                                textChannel
                                    .send({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setColor("#ff3838")
                                                .setTitle("❌ Error")
                                                .setDescription(
                                                    "An error occurred while playing music: " +
                                                        (error?.message ||
                                                            "Unknown error"),
                                                )
                                                .setTimestamp(),
                                        ],
                                    })
                                    .catch((e) =>
                                        Logger.error(
                                            "Failed to send error message to queue text channel:",
                                            e,
                                        ),
                                    );
                            }
                        } catch (e) {
                            Logger.error("Failed to handle DisTube error:", e);
                        }
                    }
                }
            } catch (e) {
                Logger.error("Critical error in DisTube error handler:", e);
            }
        });

        // Empty channel event
        this.distube.on("empty", (channel) => {
            try {
                if (channel && typeof channel.send === "function") {
                    channel
                        .send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#2b2d31")
                                    .setDescription(
                                        "👋 Everyone left the voice channel, leaving the channel.",
                                    )
                                    .setTimestamp(),
                            ],
                        })
                        .catch((err) => {
                            Logger.error(
                                "Failed to send empty channel message:",
                                err,
                            );
                        });
                }
            } catch (error) {
                Logger.error("Error in empty event:", error);
            }
        });

        // Finish queue event
        this.distube.on("finish", (queue) => {
            try {
                const channel = queue.textChannel as TextChannel;
                if (channel && typeof channel.send === "function") {
                    channel
                        .send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#2b2d31")
                                    .setDescription(
                                        "🏁 Queue finished! Use the play command to add more songs.",
                                    )
                                    .setTimestamp(),
                            ],
                        })
                        .catch((err) => {
                            Logger.error(
                                "Failed to send queue finished message:",
                                err,
                            );
                        });
                }
            } catch (error) {
                Logger.error("Error in finish event:", error);
            }
        });

        // Initiate event
        this.distube.on("initQueue", (queue) => {
            try {
                // Set default volume
                queue.setVolume(80);
                Logger.info("Initialized new queue with default settings");
            } catch (error) {
                Logger.error("Error in initQueue event:", error);
            }
        });

        // Debug disconnection events
        this.distube.on("disconnect", (queue) => {
            Logger.info(
                `DisTube disconnected from ${queue.voiceChannel?.name || "Unknown channel"}`,
            );
        });

        // Search result event (optional, for more detailed search feedback)
        this.distube.on("searchResult", (message, result) => {
            Logger.info(`Search results found: ${result.length} items`);
        });

        this.distube.on("searchCancel", (message) => {
            Logger.info("Search was canceled");
        });

        this.distube.on("searchInvalidAnswer", (message) => {
            Logger.info("Invalid search answer received");
        });

        this.distube.on("searchDone", () => {
            Logger.info("Search completed");
        });
    }
}
