////////////////////////////////////////////////////////////////////
///// WARNING: This file is not being used in the project.     /////
///// If you want to use it, you need to import it in index.ts /////
///// As this file is not being used, it is not being tested.  /////
///// It may or may not work as expected.                      /////
///// And it may crash the bot.                                /////
///// You have been warned.                                    /////
////////////////////////////////////////////////////////////////////

import { ShardingManager } from "discord.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Logger } from "../utils/logger";

// For ESM: obtain __dirname.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ShardHandler {
  private manager: ShardingManager;

  constructor() {
    const env = { ...process.env };
    delete env.SHARDING_MANAGER;

    this.manager = new ShardingManager(
      join(__dirname, "..", "..", "index.ts"),
      {
        token: process.env.DISCORD_TOKEN,
        totalShards: "auto",
        mode: "process",
        respawn: true,
        env,
      },
    );

    this.registerEvents();
  }

  private registerEvents(): void {
    this.manager.on("shardCreate", (shard) => {
      Logger.info(`🚀 Launching Shard #${shard.id}...`);

      shard.on("spawn", () => {
        Logger.info(`🌟 Shard #${shard.id} spawned successfully!`);
      });

      shard.on("ready", () => {
        Logger.ready("SHARD READY", [
          `✨ Shard #${shard.id} is now ready!`,
          `🌐 Connection established`,
          `⚡ Ready to process events`,
        ]);
      });

      shard.on("disconnect", () => {
        Logger.warn(`💔 Shard #${shard.id} disconnected`);
      });

      shard.on("reconnecting", () => {
        Logger.info(`🔄 Shard #${shard.id} reconnecting...`);
      });

      shard.on("death", (process) => {
        Logger.error(
          `💀 Shard #${shard.id} died with exit code ${process.exitCode}`,
        );
      });

      shard.on("error", (error) => {
        Logger.error(`❌ Shard #${shard.id} encountered an error:`, error);
      });

      Logger.info(`🔄 Loading Shard #${shard.id}...`);
    });
  }

  public async spawn(): Promise<void> {
    try {
      Logger.info("🚀 Starting shard spawning process...");
      await this.manager.spawn();
      Logger.success("✨ All shards spawned successfully!");
    } catch (error) {
      Logger.fatal("Failed to spawn shards:", error);
      process.exit(1);
    }
  }

  public getManager(): ShardingManager {
    return this.manager;
  }
}
