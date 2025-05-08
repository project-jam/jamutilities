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
        this.distube.on("error", (...args: any[]) => {
            let eventChannel: TextChannel | undefined | null = null;
            let eventError: Error;

            if (args.length === 1 && args[0] instanceof Error) {
                // Signature: error(e: Error)
                eventError = args[0];
            } else if (args.length === 2 && args[1] instanceof Error) {
                // Signature: error(channel: GuildTextBasedChannel, e: Error)
                if (args[0] && typeof args[0].send === "function") {
                    eventChannel = args[0] as TextChannel;
                } else {
                    Logger.warn(
                        `DisTube 'error' event: Expected channel as first arg when two args present, got ${typeof args[0]}`,
                    );
                }
                eventError = args[1];
            } else {
                // Fallback for unknown signature or unexpected arguments
                Logger.error(
                    "DisTube error event received with unexpected arguments:",
                    args,
                );
                const foundError = args.find((arg) => arg instanceof Error);
                // Truncate JSON string to avoid excessively long log messages
                eventError =
                    foundError ||
                    new Error(
                        `Unknown DisTube error. Args: ${JSON.stringify(args).substring(0, 250)}`,
                    );
                const foundChannel = args.find(
                    (arg) => arg && typeof arg.send === "function",
                );
                if (foundChannel) eventChannel = foundChannel as TextChannel;
            }

            Logger.error("DisTube error processed:", eventError); // This should now consistently log an Error object.

            try {
                let targetChannel: TextChannel | undefined | null =
                    eventChannel;

                // Attempt to find a text channel from the error's queue if no direct channel was provided or valid
                // DisTube errors often have a 'queue' property that might contain the original textChannel.
                const queueFromError = (eventError as any).queue;
                if (
                    (!targetChannel ||
                        typeof targetChannel.send !== "function") &&
                    queueFromError?.textChannel
                ) {
                    if (
                        queueFromError.textChannel &&
                        typeof queueFromError.textChannel.send === "function"
                    ) {
                        targetChannel =
                            queueFromError.textChannel as TextChannel;
                        Logger.info(
                            "Using textChannel from error.queue for DisTube error message.",
                        );
                    }
                }

                if (targetChannel && typeof targetChannel.send === "function") {
                    targetChannel
                        .send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setTitle("❌ Music Error")
                                    .setDescription(
                                        eventError.message ||
                                            "An unknown error occurred with the music player.",
                                    )
                                    .setTimestamp(),
                            ],
                        })
                        .catch((e) =>
                            Logger.error(
                                "Failed to send DisTube error message to determined channel:",
                                e,
                            ),
                        );
                } else {
                    Logger.warn(
                        "Could not determine a valid channel to send the DisTube error message. Error content: " +
                            eventError.message,
                    );
                }
            } catch (e) {
                // This catch is for errors within the error handling logic itself.
                Logger.error(
                    "Critical error within the DisTube 'error' event handler's own try-catch block:",
                    e,
                );
            }
        });

        // Empty channel event
        this.distube.on("empty", (channel) => {
            // queue type is actually VoiceBasedChannel here, but DisTube types say "any" for channel. It refers to the voice channel.
            try {
                // This event gives the voice channel. We need the queue to find the text channel.
                const queue = this.distube.getQueue(channel.guildId);
                if (
                    queue &&
                    queue.textChannel &&
                    typeof queue.textChannel.send === "function"
                ) {
                    queue.textChannel
                        .send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#2b2d31")
                                    .setDescription(
                                        `👋 Everyone left the voice channel ${channel.name}, leaving.`,
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
                } else {
                    Logger.warn(
                        "Could not find text channel for 'empty' event notification in guild " +
                            channel.guildId,
                    );
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
                queue.setVolume(80); // Default volume
                Logger.info(
                    `Initialized new queue in ${queue.voiceChannel?.guild?.name || "a guild"} with default volume ${queue.volume}%`,
                );
            } catch (error) {
                Logger.error("Error in initQueue event:", error);
            }
        });

        // Debug disconnection events
        this.distube.on("disconnect", (queue) => {
            Logger.info(
                `DisTube disconnected from ${queue.voiceChannel?.name || "Unknown channel"} in guild ${queue.voiceChannel?.guild?.name || "Unknown Guild"}`,
            );
        });

        this.distube.on("deleteQueue", (queue) => {
            Logger.info(
                `Queue deleted for guild ${queue.voiceChannel?.guild?.name || "Unknown Guild"}`,
            );
        });

        // Search result event (optional, for more detailed search feedback)
        this.distube.on("searchResult", (message, result, query) => {
            Logger.info(
                `Search for \"${query}\" found ${result.length} items. Sent by ${message.author.tag}`,
            );
        });

        this.distube.on("searchCancel", (message, query) => {
            Logger.info(
                `Search for \"${query}\" was canceled by ${message.author.tag}`,
            );
        });

        this.distube.on("searchInvalidAnswer", (message, answer, query) => {
            Logger.info(
                `Invalid search answer \"${answer}\" for query \"${query}\" from ${message.author.tag}`,
            );
        });

        this.distube.on("searchNoResult", (message, query) => {
            try {
                const textChannel = message.channel as TextChannel;
                if (textChannel && typeof textChannel.send === "function") {
                    textChannel
                        .send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ No results found for \`${query}\`!`,
                                    )
                                    .setTimestamp(),
                            ],
                        })
                        .catch((e) =>
                            Logger.error(
                                "Failed to send 'searchNoResult' message:",
                                e,
                            ),
                        );
                }
            } catch (error) {
                Logger.error("Error in searchNoResult event:", error);
            }
        });

        this.distube.on("searchDone", (message, answer, query) => {
            // This seems to be for when a choice is made from multiple search results
            Logger.info(
                `Search for \"${query}\" completed with answer \"${answer}\" by ${message.author.tag}`,
            );
        });
    }
}
