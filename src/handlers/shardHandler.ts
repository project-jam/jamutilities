import { ShardingManager } from "discord.js";
import { join } from "path";
import { Logger } from "../utils/logger";

export class ShardHandler {
  private manager: ShardingManager;

  constructor() {
    this.manager = new ShardingManager(
      join(__dirname, "..", "..", "index.js"),
      {
        token: process.env.DISCORD_TOKEN,
        totalShards: "auto",
        respawn: true,
        mode: "worker",
      },
    );

    this.registerEvents();
  }

  private registerEvents() {
    // Shard creation event
    this.manager.on("shardCreate", (shard) => {
      Logger.info(`Launched Shard ${shard.id}`);

      // Individual shard events
      shard.on("ready", () => {
        Logger.success(`Shard ${shard.id} connected to Discord's Gateway`);
      });

      shard.on("disconnect", () => {
        Logger.warn(`Shard ${shard.id} disconnected from Discord's Gateway`);
      });

      shard.on("reconnecting", () => {
        Logger.info(`Shard ${shard.id} reconnecting to Discord's Gateway`);
      });

      shard.on("death", () => {
        Logger.error(`Shard ${shard.id} died unexpectedly`);
      });

      shard.on("error", (error) => {
        Logger.error(`Shard ${shard.id} encountered an error:`, error);
      });
    });

    // Global shard events
    this.manager.on("shardDisconnect", (closedEvent, shardId) => {
      Logger.warn(
        `Shard ${shardId} disconnected with code ${closedEvent.code}`,
      );
    });

    this.manager.on("shardReconnecting", (shardId) => {
      Logger.info(`Shard ${shardId} is reconnecting...`);
    });

    this.manager.on("shardResume", (shardId, replayedEvents) => {
      Logger.success(
        `Shard ${shardId} resumed. Replayed ${replayedEvents} events.`,
      );
    });

    this.manager.on("shardError", (error, shardId) => {
      Logger.error(`Shard ${shardId} encountered an error:`, error);
    });
  }

  public async spawn() {
    try {
      Logger.info("Starting shard spawning process...");
      await this.manager.spawn();
      Logger.success("All shards spawned successfully!");
    } catch (error) {
      Logger.fatal("Failed to spawn shards:", error);
      process.exit(1);
    }
  }

  // Method to get total guild count across all shards
  public async getTotalGuilds(): Promise<number> {
    try {
      const guildCounts = (await this.manager.fetchClientValues(
        "guilds.cache.size",
      )) as number[];
      return guildCounts.reduce((acc, count) => acc + count, 0);
    } catch (error) {
      Logger.error("Failed to fetch total guild count:", error);
      return 0;
    }
  }

  // Method to broadcast an evaluation to all shards
  public async broadcastEval<T>(fn: () => T): Promise<T[]> {
    try {
      return await this.manager.broadcastEval(fn);
    } catch (error) {
      Logger.error("Failed to broadcast eval:", error);
      return [];
    }
  }

  // Get the ShardingManager instance
  public getManager(): ShardingManager {
    return this.manager;
  }
}
