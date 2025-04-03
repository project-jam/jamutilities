////////////////////////////////////////////////////////////////////
///// WARNING: This file is not being used in the project.     /////
///// Even tho it's a command, don't run it.                   /////
///// As this file is not being used, it is not being tested.  /////
///// It may or may not work as expected.                      /////
///// And it may crash the bot.                                /////
///// You have been warned.                                    /////
////////////////////////////////////////////////////////////////////

import {
    joinVoiceChannel,
    createAudioPlayer,
    VoiceConnection,
    VoiceConnectionStatus,
    VoiceConnectionDisconnectReason,
    AudioPlayerStatus,
    AudioPlayer,
    getVoiceConnection,
} from "@discordjs/voice";
import {
    CommandInteraction,
    VoiceChannel,
    Message,
    GuildResolvable,
} from "discord.js";
import { Logger } from "../utils/logger";
import { Command } from "../types/Command";

export class MusicHandler {
    private client: any;
    private audioPlayer: AudioPlayer;
    private voiceConnections: Map<string, VoiceConnection> = new Map();

    constructor(client: any) {
        this.client = client;
        this.audioPlayer = createAudioPlayer();

        this.audioPlayer.on("error", (error) => {
            Logger.error("Audio player error: ", error);
        });
    }

    public async joinVoiceChannel(
        interaction: CommandInteraction | Message,
        channel: VoiceChannel,
    ): Promise<void> {
        try {
            // Check if already connected to this channel
            const existingConnection = getVoiceConnection(channel.guild.id);
            if (existingConnection) {
                if (existingConnection.joinConfig.channelId === channel.id) {
                    // Already connected to this channel
                    if (interaction instanceof Message) {
                        await interaction.channel.send(
                            "✅ Already in this voice channel.",
                        );
                    } else {
                        await interaction.editReply(
                            "✅ Already in this voice channel.",
                        );
                    }
                    return;
                } else {
                    // Connected to a different channel, destroy it first
                    existingConnection.destroy();
                }
            }

            // Join the voice channel
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator as any,
            });

            // Store the connection
            this.voiceConnections.set(channel.guild.id, connection);

            // Set up event handlers
            connection.on(VoiceConnectionStatus.Ready, () => {
                Logger.info(
                    `Successfully joined voice channel ${channel.name} in ${channel.guild.name}`,
                );
            });

            connection.on(
                VoiceConnectionStatus.Disconnected,
                async (_, reason) => {
                    Logger.info(
                        `Voice connection disconnected from ${channel.name}: ${reason}`,
                    );
                    try {
                        if (
                            reason ===
                                VoiceConnectionDisconnectReason.WebSocketClose &&
                            reason.code === 4014
                        ) {
                            // If the WebSocket closed with a 4014 code, reconnect
                            await Promise.race([
                                entersState(
                                    connection,
                                    VoiceConnectionStatus.Connecting,
                                    5000,
                                ),
                                new Promise((_, reject) =>
                                    setTimeout(reject, 5000),
                                ),
                            ]).catch(() => {
                                // Remove the connection from our map
                                this.voiceConnections.delete(channel.guild.id);
                                connection.destroy();
                            });
                        } else {
                            // Otherwise, destroy the connection
                            this.voiceConnections.delete(channel.guild.id);
                            connection.destroy();
                        }
                    } catch (error) {
                        Logger.error(
                            "Error handling voice disconnection:",
                            error,
                        );
                        this.voiceConnections.delete(channel.guild.id);
                        connection.destroy();
                    }
                },
            );

            // Subscribe the audio player to the voice connection
            connection.subscribe(this.audioPlayer);

            // Send success message
            if (interaction instanceof Message) {
                await interaction.channel.send(
                    `✅ Successfully joined the voice channel: ${channel.name}`,
                );
            } else {
                await interaction.editReply(
                    `✅ Successfully joined the voice channel: ${channel.name}`,
                );
            }
        } catch (error) {
            Logger.error("Error joining voice channel:", error);
            const errorMessage =
                "❌ Failed to join the voice channel. Please try again later.";

            if (interaction instanceof Message) {
                await interaction.channel.send(errorMessage);
            } else {
                await interaction.editReply(errorMessage);
            }
        }
    }

    public async leaveVoiceChannel(
        guildId: string,
        interaction: CommandInteraction | Message,
    ): Promise<boolean> {
        try {
            // Get the voice connection
            const connection =
                getVoiceConnection(guildId) ||
                this.voiceConnections.get(guildId);

            if (!connection) {
                const notConnectedMessage =
                    "❌ I'm not connected to any voice channel in this server.";

                if (interaction instanceof Message) {
                    await interaction.channel.send(notConnectedMessage);
                } else {
                    await interaction.editReply(notConnectedMessage);
                }
                return false;
            }

            // Stop the audio player if it's playing
            if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
                this.audioPlayer.stop(true);
            }

            // Destroy the connection and remove it from our map
            connection.destroy();
            this.voiceConnections.delete(guildId);

            const successMessage = "👋 Successfully left the voice channel.";

            if (interaction instanceof Message) {
                await interaction.channel.send(successMessage);
            } else {
                await interaction.editReply(successMessage);
            }

            Logger.info(`Left voice channel in guild: ${guildId}`);
            return true;
        } catch (error) {
            Logger.error("Error leaving voice channel:", error);
            const errorMessage =
                "❌ An error occurred while trying to leave the voice channel.";

            if (interaction instanceof Message) {
                await interaction.channel.send(errorMessage);
            } else {
                await interaction.editReply(errorMessage);
            }
            return false;
        }
    }

    // Helper method for entersState
    private async entersState(
        connection: VoiceConnection,
        status: VoiceConnectionStatus,
        timeout: number,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const onStateChange = (oldState: any, newState: any) => {
                if (newState.status === status) {
                    connection.off("stateChange", onStateChange);
                    resolve();
                }
            };

            connection.on("stateChange", onStateChange);

            // If the connection already has the status, resolve immediately
            if (connection.state.status === status) {
                connection.off("stateChange", onStateChange);
                resolve();
            }

            // Set a timeout to reject the promise
            const timeoutHandle = setTimeout(() => {
                connection.off("stateChange", onStateChange);
                reject(
                    new Error(
                        `Connection failed to reach state ${status} within ${timeout}ms`,
                    ),
                );
            }, timeout);

            // Clear the timeout when the promise resolves
            new Promise(
                (res) =>
                    (resolve = (value) => {
                        clearTimeout(timeoutHandle);
                        res(value);
                    }),
            );
        });
    }
}
