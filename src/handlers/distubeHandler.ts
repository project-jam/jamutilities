import {
    Client,
    EmbedBuilder,
    TextChannel,
    VoiceChannel as DiscordVoiceChannel,
} from "discord.js";
import { DisTube, Queue, Song } from "distube";
import { YtDlpPlugin } from "@distube/yt-dlp";
import { Logger } from "../utils/logger";

let instance: DistubeHandler | null = null;
const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 1 minute

export class DistubeHandler {
    public distube: DisTube;
    private client: Client;
    private inactivityTimers: Map<string, NodeJS.Timeout>;

    private constructor(client: Client) {
        this.client = client;
        this.inactivityTimers = new Map();
        this.distube = new DisTube(client, {
            plugins: [new YtDlpPlugin({ update: false })],
            // v5 no longer supports leaveOnEmpty/emptyCooldown, so we handle it manually
            emitNewSongOnly: true,
            joinNewVoiceChannel: false,
            savePreviousSongs: false,
            nsfw: false,
        });
        this.setupEventListeners();
        Logger.info("DisTube handler initialized with custom inactivity logic");
    }

    public static getInstance(client: Client): DistubeHandler {
        if (!instance) {
            instance = new DistubeHandler(client);
        }
        return instance;
    }

    private clearInactivityTimer(guildId: string): void {
        if (this.inactivityTimers.has(guildId)) {
            clearTimeout(this.inactivityTimers.get(guildId)!);
            this.inactivityTimers.delete(guildId);
            Logger.info(`[Inactivity] Timer cleared for guild ${guildId}`);
        }
    }

    public setInactivityTimer(
        guildId: string,
        voiceChannelId: string,
        textChannel: TextChannel | undefined,
    ): void {
        this.clearInactivityTimer(guildId);
        Logger.info(
            `[Inactivity] Setting 1-minute timer for guild ${guildId} in VC ${voiceChannelId}`,
        );
        const timer = setTimeout(async () => {
            try {
                const currentVoiceConnection = this.distube.voices.get(guildId);
                const currentQueue = this.distube.getQueue(guildId);
                // still in the same VC?
                if (
                    currentVoiceConnection &&
                    currentVoiceConnection.channel.id === voiceChannelId
                ) {
                    // no queue or nothing playing
                    if (
                        !currentQueue ||
                        (currentQueue.songs.length === 0 &&
                            !currentQueue.playing)
                    ) {
                        Logger.info(
                            `[Inactivity] Timeout reached for guild ${guildId}. Leaving VC ${voiceChannelId}.`,
                        );
                        await this.distube.voices.leave(guildId);
                        if (textChannel) {
                            textChannel
                                .send({
                                    embeds: [
                                        new EmbedBuilder()
                                            .setColor("#2b2d31")
                                            .setDescription(
                                                "👋 Leaving the voice channel due to inactivity.",
                                            ),
                                    ],
                                })
                                .catch((e) =>
                                    Logger.error(
                                        "[Inactivity] Failed to send leave message:",
                                        e,
                                    ),
                                );
                        }
                    } else {
                        Logger.info(
                            `[Inactivity] Bot is active after timeout in guild ${guildId}, not leaving.`,
                        );
                    }
                } else {
                    Logger.info(
                        `[Inactivity] Bot not in expected VC for guild ${guildId} at timeout, not leaving.`,
                    );
                }
            } catch (error) {
                Logger.error(
                    "[Inactivity] Error during timer execution:",
                    error,
                );
            } finally {
                this.inactivityTimers.delete(guildId);
            }
        }, INACTIVITY_TIMEOUT_MS);
        this.inactivityTimers.set(guildId, timer);
    }

    private setupEventListeners(): void {
        // When a queue is created, start inactivity timer
        this.distube.on("initQueue", (queue: Queue) => {
            try {
                queue.setVolume(80);
                if (queue.voiceChannel) {
                    this.setInactivityTimer(
                        queue.id,
                        queue.voiceChannel.id,
                        queue.textChannel,
                    );
                }
            } catch (error) {
                Logger.error("Error in initQueue event:", error);
            }
        });

        // Clear timer when a song starts playing
        this.distube.on("playSong", (queue: Queue, song: Song) => {
            this.clearInactivityTimer(queue.id);
            try {
                // Create a progress bar for the beginning of the song
                const progressBar = "🔘▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";

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
                            value:
                                song.user?.tag ||
                                song.member?.user.tag ||
                                "Unknown",
                            inline: true,
                        },
                        {
                            name: "Progress",
                            value: progressBar,
                            inline: false,
                        },
                    )
                    .setImage(song.thumbnail || null) // Use setImage instead of setThumbnail for banner style
                    .setTimestamp();

                queue.textChannel
                    ?.send({ embeds: [embed] })
                    .catch((err) =>
                        Logger.error("Failed to send playSong message:", err),
                    );
            } catch (error) {
                Logger.error("Error in playSong event:", error);
            }
        });

        // Clear timer when a song is added
        this.distube.on("addSong", (queue: Queue, song: Song) => {
            this.clearInactivityTimer(queue.id);
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
                            value:
                                song.user?.tag ||
                                song.member?.user.tag ||
                                "Unknown",
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

                queue.textChannel
                    ?.send({ embeds: [embed] })
                    .catch((err) =>
                        Logger.error("Failed to send addSong message:", err),
                    );
            } catch (error) {
                Logger.error("Error in addSong event:", error);
            }
        });

        // Clear timer when a playlist is added
        this.distube.on("addList", (queue: Queue, playlist) => {
            this.clearInactivityTimer(queue.id);
            try {
                queue.textChannel
                    ?.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setTitle("🎵 Playlist Added")
                                .setDescription(
                                    `Added **${playlist.songs.length}** songs from [${playlist.name || "playlist"}](${playlist.url}) to the queue.`,
                                )
                                .setThumbnail(playlist.thumbnail || null)
                                .setTimestamp(),
                        ],
                    })
                    .catch((err) =>
                        Logger.error("Failed to send addList message:", err),
                    );
            } catch (error) {
                Logger.error("Error in addList event:", error);
            }
        });

        // Queue finished: start inactivity timer
        this.distube.on("finish", (queue: Queue) => {
            if (queue.voiceChannel) {
                this.setInactivityTimer(
                    queue.id,
                    queue.voiceChannel.id,
                    queue.textChannel,
                );
            }
            try {
                queue.textChannel
                    ?.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription("🏁 Queue finished!")
                                .setTimestamp(),
                        ],
                    })
                    .catch((err) =>
                        Logger.error("Failed to send finish message:", err),
                    );
            } catch (error) {
                Logger.error("Error in finish event:", error);
            }
        });

        // Voice channel empty: start inactivity timer
        this.distube.on("empty", (queue: Queue) => {
            if (queue.voiceChannel) {
                this.setInactivityTimer(
                    queue.id,
                    queue.voiceChannel.id,
                    queue.textChannel,
                );
            }
            try {
                queue.textChannel
                    ?.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    "👋 Channel empty. I will leave soon if no one joins or plays music.",
                                )
                                .setTimestamp(),
                        ],
                    })
                    .catch((err) =>
                        Logger.error(
                            "Failed to send empty channel message:",
                            err,
                        ),
                    );
            } catch (error) {
                Logger.error("Error in empty event:", error);
            }
        });

        // Clean up on disconnect or queue deletion
        this.distube.on("disconnect", (queue: Queue) => {
            this.clearInactivityTimer(queue.id);
        });

        this.distube.on("deleteQueue", (queue: Queue) => {
            this.clearInactivityTimer(queue.id);
        });

        // Error handling
        this.distube.on("error", (...args: any[]) => {
            let eventChannel: TextChannel | undefined;
            let eventError: Error;
            let queueIdForError: string | undefined;

            if (args.length === 1 && args[0] instanceof Error) {
                eventError = args[0];
                queueIdForError = (eventError as any).queue?.id;
            } else if (args.length === 2 && args[1] instanceof Error) {
                if ((args[0] as TextChannel).send) {
                    eventChannel = args[0] as TextChannel;
                    queueIdForError = eventChannel.guild?.id;
                } else {
                    const errorQueue = args[0] as Queue;
                    eventChannel = errorQueue.textChannel!;
                    queueIdForError = errorQueue.id;
                }
                eventError = args[1];
            } else {
                eventError = new Error("Unknown DisTube error");
                const maybeQueue = args.find((arg) => (arg as Queue)?.id);
                queueIdForError = (maybeQueue as Queue)?.id;
                const maybeChannel = args.find(
                    (arg) => (arg as TextChannel)?.send,
                );
                eventChannel = maybeChannel as TextChannel;
            }

            Logger.error(
                `DisTube error in guild ${queueIdForError}:`,
                eventError,
            );

            if (queueIdForError) this.clearInactivityTimer(queueIdForError);

            try {
                eventChannel
                    ?.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setTitle("❌ Music Error")
                                .setDescription(eventError.message)
                                .setTimestamp(),
                        ],
                    })
                    .catch((e) =>
                        Logger.error("Failed to send error embed:", e),
                    );
            } catch (e) {
                Logger.error("Error in error event handler:", e);
            }
        });

        // Search events (logging only)
        this.distube.on("searchResult", (message, result, query) => {
            Logger.info(
                `Search for "${query}" returned ${result.length} items.`,
            );
        });

        this.distube.on("searchCancel", (message, query) => {
            Logger.info(`Search for "${query}" was canceled.`);
        });

        this.distube.on("searchNoResult", (message, query) => {
            message.channel
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
                    Logger.error("Failed to send no-result embed:", e),
                );
        });

        this.distube.on("searchInvalidAnswer", (message, answer, query) => {
            Logger.info(`Invalid search answer "${answer}" for "${query}".`);
        });

        this.distube.on("searchDone", (message, answer, query) => {
            Logger.info(`Search "${query}" completed with choice "${answer}".`);
        });
    }
}
