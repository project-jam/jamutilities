import { Client, EmbedBuilder, TextChannel, VoiceChannel as DiscordVoiceChannel } from "discord.js";
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
            leaveOnEmpty: false, // We will handle this with our custom timer
            leaveOnFinish: false, // We will handle this with our custom timer
            leaveOnStop: true,   // Default behavior is fine for explicit stops
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

    public setInactivityTimer(guildId: string, voiceChannelId: string, textChannel: TextChannel | undefined): void {
        this.clearInactivityTimer(guildId); // Clear any existing timer first

        Logger.info(`[Inactivity] Setting 1-minute timer for guild ${guildId} in VC ${voiceChannelId}`);
        const timer = setTimeout(async () => {
            try {
                const currentVoiceConnection = this.distube.voices.get(guildId);
                const currentQueue = this.distube.getQueue(guildId);

                if (currentVoiceConnection && currentVoiceConnection.channel.id === voiceChannelId) {
                    if (!currentQueue || (currentQueue.songs.length === 0 && !currentQueue.playing)) {
                        Logger.info(`[Inactivity] Timeout reached for guild ${guildId}. Leaving voice channel ${voiceChannelId}.`);
                        await this.distube.voices.leave(guildId);
                        if (textChannel && typeof textChannel.send === 'function') {
                            textChannel.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("#2b2d31")
                                        .setDescription("👋 Leaving the voice channel due to inactivity."),
                                ],
                            }).catch(e => Logger.error("[Inactivity] Failed to send inactivity leave message:", e));
                        }
                    } else {
                        Logger.info(`[Inactivity] Timeout reached for guild ${guildId}, but bot is active. Timer ignored.`);
                    }
                } else {
                     Logger.info(`[Inactivity] Timeout reached for guild ${guildId}, but bot not in the expected VC or not in VC. Timer ignored.`);
                }
            } catch (error) {
                Logger.error("[Inactivity] Error during inactivity timer execution:", error);
            } finally {
                this.inactivityTimers.delete(guildId); // Ensure timer is removed
            }
        }, INACTIVITY_TIMEOUT_MS);

        this.inactivityTimers.set(guildId, timer);
    }

    private setupEventListeners(): void {
        this.distube.on("initQueue", (queue: Queue) => {
            try {
                queue.setVolume(80);
                Logger.info(`Initialized new queue in ${queue.voiceChannel?.guild?.name || "a guild"} with default volume ${queue.volume}%`);
                if (queue.voiceChannel) {
                    this.setInactivityTimer(queue.id, queue.voiceChannel.id, queue.textChannel);
                }
            } catch (error) {
                Logger.error("Error in initQueue event:", error);
            }
        });

        this.distube.on("playSong", (queue: Queue, song: Song) => {
            this.clearInactivityTimer(queue.id);
            try {
                const embed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle("🎵 Now Playing")
                    .setDescription(`[${song.name}](${song.url})`)
                    .addFields(
                        { name: "Duration", value: song.formattedDuration, inline: true },
                        { name: "Requested By", value: song.user?.tag || "Unknown", inline: true },
                    )
                    .setThumbnail(song.thumbnail || null)
                    .setTimestamp();
                if (queue.textChannel && typeof queue.textChannel.send === "function") {
                    queue.textChannel.send({ embeds: [embed] }).catch(err => Logger.error("Failed to send playSong message:", err));
                }
            } catch (error) {
                Logger.error("Error in playSong event:", error);
            }
        });

        this.distube.on("addSong", (queue: Queue, song: Song) => {
            this.clearInactivityTimer(queue.id);
            try {
                const embed = new EmbedBuilder()
                    .setColor("#2b2d31")
                    .setTitle("🎵 Added to Queue")
                    .setDescription(`[${song.name}](${song.url})`)
                    .addFields(
                        { name: "Duration", value: song.formattedDuration, inline: true },
                        { name: "Requested By", value: song.user?.tag || "Unknown", inline: true },
                        { name: "Position", value: `${queue.songs.length}`, inline: true },
                    )
                    .setThumbnail(song.thumbnail || null)
                    .setTimestamp();
                if (queue.textChannel && typeof queue.textChannel.send === "function") {
                    queue.textChannel.send({ embeds: [embed] }).catch(err => Logger.error("Failed to send addSong message:", err));
                }
            } catch (error) {
                Logger.error("Error in addSong event:", error);
            }
        });
        
        this.distube.on("addList", (queue: Queue, playlist) => {
            this.clearInactivityTimer(queue.id);
            Logger.info(`Playlist ${playlist.name} added to queue in guild ${queue.id}`);
             if (queue.textChannel && typeof queue.textChannel.send === "function") {
                queue.textChannel.send({ embeds: [
                    new EmbedBuilder()
                        .setColor("#2b2d31")
                        .setTitle("🎵 Playlist Added")
                        .setDescription(`Added **${playlist.songs.length}** songs from [${playlist.name || 'playlist'}](${playlist.url}) to the queue.`)
                        .setThumbnail(playlist.thumbnail || null)
                        .setTimestamp()
                ]}).catch(err => Logger.error("Failed to send addList message:", err));
            }
        });

        this.distube.on("finish", (queue: Queue) => {
            Logger.info(`Queue finished for guild ${queue.id}. Starting inactivity timer.`);
            if (queue.voiceChannel) { 
                 this.setInactivityTimer(queue.id, queue.voiceChannel.id, queue.textChannel);
            }
            try {
                if (queue.textChannel && typeof queue.textChannel.send === "function") {
                    queue.textChannel.send({
                        embeds: [
                            new EmbedBuilder().setColor("#2b2d31").setDescription("🏁 Queue finished!").setTimestamp(),
                        ],
                    }).catch(err => Logger.error("Failed to send queue finished message:", err));
                }
            } catch (error) {
                Logger.error("Error in finish event:", error);
            }
        });

        this.distube.on("empty", (queue: Queue) => { 
            Logger.info(`Voice channel ${queue.voiceChannel?.name} became empty in guild ${queue.id}. Starting inactivity timer.`);
            if (queue.voiceChannel) {
                this.setInactivityTimer(queue.id, queue.voiceChannel.id, queue.textChannel);
            }
            try {
                 if (queue.textChannel && typeof queue.textChannel.send === "function") {
                    queue.textChannel.send({ embeds: [
                        new EmbedBuilder().setColor("#2b2d31").setDescription(`👋 Channel empty. I will leave soon if no one joins or plays music.`).setTimestamp()
                    ]}).catch(err => Logger.error("Failed to send empty channel message:", err));
                }
            } catch (error) {
                Logger.error("Error in empty event message sending:", error);
            }
        });
        
        this.distube.on("disconnect", (queue: Queue) => {
            Logger.info(`Disconnected from voice channel in guild ${queue.id}. Clearing inactivity timer.`);
            this.clearInactivityTimer(queue.id);
        });

        this.distube.on("deleteQueue", (queue: Queue) => {
            Logger.info(`Queue deleted for guild ${queue.id}. Clearing inactivity timer.`);
            this.clearInactivityTimer(queue.id);
        });

        this.distube.on("error", (...args: any[]) => {
            let eventChannel: TextChannel | undefined | null = null;
            let eventError: Error;
            let queueIdForError: string | undefined = undefined;

            if (args.length === 1 && args[0] instanceof Error) {
                eventError = args[0];
                if ((eventError as any).queue?.id) queueIdForError = (eventError as any).queue.id;
            } else if (args.length === 2 && args[1] instanceof Error) {
                if (args[0] && typeof args[0].send === 'function') { 
                    eventChannel = args[0] as TextChannel;
                    if((args[0] as TextChannel).guild?.id) queueIdForError = (args[0]as TextChannel).guild.id;
                } else if (args[0] && (args[0] as Queue).id) { 
                     const errorQueue = args[0] as Queue;
                     eventChannel = errorQueue.textChannel;
                     queueIdForError = errorQueue.id;
                } else {
                    Logger.warn(`DisTube 'error' event: Expected channel or queue as first arg, got ${typeof args[0]}`);
                }
                eventError = args[1];
            } else {
                Logger.error("DisTube error event received with unexpected arguments:", args);
                const foundError = args.find(arg => arg instanceof Error);
                eventError = foundError || new Error(`Unknown DisTube error. Args: ${JSON.stringify(args).substring(0, 250)}`);
                const foundChannelArg = args.find(arg => arg && typeof arg.send === 'function');
                if (foundChannelArg) eventChannel = foundChannelArg as TextChannel;
                const foundQueueArg = args.find(arg => arg && (arg as Queue).id);
                if (foundQueueArg) {
                    queueIdForError = (foundQueueArg as Queue).id;
                    if (!eventChannel) eventChannel = (foundQueueArg as Queue).textChannel;
                }
            }
        
            Logger.error(`DisTube error processed for guild ${queueIdForError || 'unknown'}:`, eventError);
        
            if (queueIdForError) {
                this.clearInactivityTimer(queueIdForError);
            }

            try {
                let targetChannel: TextChannel | undefined | null = eventChannel;
                const queueFromError = (eventError as any).queue as Queue | undefined;
                if ((!targetChannel || typeof targetChannel.send !== 'function') && queueFromError?.textChannel) {
                    if (queueFromError.textChannel && typeof queueFromError.textChannel.send === 'function') {
                        targetChannel = queueFromError.textChannel;
                        Logger.info("Using textChannel from error.queue for DisTube error message.");
                    }
                }
        
                if (targetChannel && typeof targetChannel.send === 'function') {
                    targetChannel.send({
                        embeds: [
                            new EmbedBuilder().setColor("#ff3838").setTitle("❌ Music Error")
                                .setDescription(eventError.message || "An unknown error occurred with the music player.").setTimestamp(),
                        ],
                    }).catch(e => Logger.error("Failed to send DisTube error message to determined channel:", e));
                } else {
                    Logger.warn("Could not determine a valid channel to send the DisTube error message. Error content: " + eventError.message);
                }
            } catch (e) {
                Logger.error("Critical error within the DisTube 'error' event handler's own try-catch block:", e);
            }
        });

        this.distube.on("searchResult", (message, result, query) => {
            Logger.info(`Search for \"${query}\" found ${result.length} items. Sent by ${message.author.tag}`);
        });
        this.distube.on("searchCancel", (message, query) => {
            Logger.info(`Search for \"${query}\" was canceled by ${message.author.tag}`);
        });
        this.distube.on("searchInvalidAnswer", (message, answer, query) => {
            Logger.info(`Invalid search answer \"${answer}\" for query \"${query}\" from ${message.author.tag}`);
        });
        this.distube.on("searchNoResult", (message, query) => {
            try {
                const textChannel = message.channel as TextChannel;
                if (textChannel && typeof textChannel.send === 'function') {
                    textChannel.send({
                        embeds: [ new EmbedBuilder().setColor("#ff3838").setDescription(`❌ No results found for \`${query}\`!`).setTimestamp()]
                    }).catch(e => Logger.error("Failed to send 'searchNoResult' message:", e));
                }
            } catch (error) {
                Logger.error("Error in searchNoResult event:", error);
            }
        });
        this.distube.on("searchDone", (message, answer, query) => {
            Logger.info(`Search for \"${query}\" completed with answer \"${answer}\" by ${message.author.tag}`);
        });
    }
}
