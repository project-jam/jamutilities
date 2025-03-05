////////////////////////////////////////////////////////////////////
///// WARNING: This file is not being used in the project.     /////
///// If you want to use it, you need to import it in index.ts /////
///// As this file is not being used, it is not being tested.  /////
///// It may or may not work as expected.                      /////
///// And it may crash the bot.                                /////
///// You have been warned.                                    /////
////////////////////////////////////////////////////////////////////

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  demuxProbe,
  entersState,
  VoiceConnection,
  VoiceConnectionStatus,
  VoiceConnectionDisconnectReason,
  AudioPlayerStatus,
  AudioPlayer,
  AudioResource,
  StreamType,
} from "@discordjs/voice";
import { CommandInteraction, VoiceChannel } from "discord.js";
import play from "play-dl";
import { PassThrough } from "stream";
import { Logger } from "../utils/logger";
import { Command } from "../types/Command";

/**
 * Converts an async iterable (yielding Buffer chunks) into a Node.js Readable stream
 * in binary mode (objectMode disabled).
 */
function asyncIterableToStream<T>(
  iterable: AsyncIterable<T>,
): NodeJS.ReadableStream {
  const passThrough = new PassThrough({ objectMode: false });
  (async () => {
    for await (const chunk of iterable) {
      passThrough.write(chunk);
    }
    passThrough.end();
  })();
  return passThrough;
}

/**
 * Attempts to return a valid YouTube watch URL.
 * If the query is already a URL and belongs to YouTube, it is returned.
 * Otherwise, it uses play-dl to search for the video.
 */
export async function getVideoURL(query: string): Promise<string | null> {
  // Check if query is a valid URL and looks like a YouTube URL.
  try {
    const url = new URL(query);
    if (
      url.hostname.includes("youtube.com") ||
      url.hostname.includes("youtu.be")
    ) {
      return query;
    }
  } catch (error) {
    // Not a valid URL; continue to search.
  }

  // Use play-dl's search functionality to find the video.
  try {
    const results = await play.search(query, {
      limit: 1,
      source: { youtube: "video" },
    });
    if (results.length > 0 && results[0].url) {
      return results[0].url;
    }
    return null;
  } catch (error) {
    Logger.error("Error searching YouTube:", error);
    return null;
  }
}

export class MusicHandler {
  private client: any;
  private commands: Map<string, Command> = new Map();
  private voiceConnection: VoiceConnection | null = null;
  private audioPlayer: AudioPlayer;
  private audioResource: AudioResource | null = null;

  constructor(client: any) {
    this.client = client;
    this.audioPlayer = createAudioPlayer();

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      Logger.info("Audio player is idle. Leaving voice channel...");
      this.voiceConnection?.destroy();
    });

    this.audioPlayer.on("error", (error) => {
      Logger.error("Audio player error: ", error);
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      Logger.info("Now playing music.");
    });
  }

  public async joinVoiceChannel(
    interaction: CommandInteraction,
    channel: VoiceChannel,
  ): Promise<void> {
    this.voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as any,
    });

    this.voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      Logger.info("Successfully joined voice channel.");
    });

    this.voiceConnection.on(
      VoiceConnectionStatus.Disconnected,
      async (_, reason) => {
        Logger.info(`Voice connection disconnected: ${reason}`);
        if (
          reason === VoiceConnectionDisconnectReason.WebSocketClose &&
          reason.code === 4014
        ) {
          Logger.info(
            "WebSocket closed with code 4014, attempting to reconnect...",
          );
          try {
            await entersState(
              this.voiceConnection!,
              VoiceConnectionStatus.Connecting,
              5000,
            );
          } catch {
            this.voiceConnection?.destroy();
          }
        } else if (this.voiceConnection) {
          this.voiceConnection.destroy();
        }
      },
    );

    this.voiceConnection.subscribe(this.audioPlayer);
    await interaction.editReply("✅ Successfully joined voice channel.");
  }

  public async play(
    query: string,
    channel: VoiceChannel,
    interaction: CommandInteraction,
  ): Promise<void> {
    let videoUrl: string | null;
    try {
      videoUrl = await getVideoURL(query);
    } catch (error) {
      Logger.error("Error fetching YouTube video info:", error);
      await interaction.editReply(
        "❌ Error fetching YouTube video info. Please try again later.",
      );
      return;
    }

    if (!videoUrl) {
      await interaction.editReply("❌ Invalid video URL or search query.");
      return;
    }

    await this.joinVoiceChannel(interaction, channel);

    try {
      // Fetch the stream data from play-dl using the valid YouTube URL.
      const streamData = await play.stream(videoUrl, {
        type: StreamType.Arbitrary,
      });

      // Convert the async iterable stream into a Node.js Readable stream in binary mode.
      const nodeStream = asyncIterableToStream(streamData.stream);

      // Probe the stream to detect its format.
      const probe = await demuxProbe(nodeStream);
      const resource = createAudioResource(probe.stream, {
        inputType: probe.type,
      });

      this.audioPlayer.play(resource);
      this.audioResource = resource;
      this.voiceConnection?.subscribe(this.audioPlayer);

      await interaction.editReply(`🎵 Now playing: ${videoUrl}`);
    } catch (error) {
      Logger.error("Error while playing music: ", error);
      await interaction.editReply("❌ Failed to play music.");
    }
  }

  public async stop(): Promise<void> {
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
      this.audioPlayer.stop();
    }
    if (this.voiceConnection) {
      this.voiceConnection.destroy();
      this.voiceConnection = null;
    }
    Logger.info("Music stopped and voice connection destroyed.");
  }
}
