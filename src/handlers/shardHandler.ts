////////////////////////////////////////////////////////////////////
///// WARNING: This file is not being used in the project.     /////
///// If you want to use it, you need to import it in index.ts /////
///// As this file is not being used, it is not being tested.  /////
///// It may or may not work as expected.                      /////
///// And it may crash the bot.                                /////
///// You have been warned.                                    /////
////////////////////////////////////////////////////////////////////

import { ShardingManager } from "discord.js";
import { join } from "path";
import { Logger } from "../utils/logger";

export class ShardHandler {
  private manager: ShardingManager;

  constructor() {
    this.manager = new ShardingManager(
      join(__dirname, "..", "..", "index.ts"),
      {
        token: process.env.DISCORD_TOKEN,
        totalShards: "auto",
        respawn: true,
        mode: "process",
      },
    );

    this.registerEvents();
  }

  private registerEvents(): void {
    this.manager.on("shardCreate", (shard) => {
      Logger.info(`🚀 Launching Shard #${shard.id}`);

      shard.on("ready", () => {
        Logger.ready("SHARD READY", [
          `✨ Shard #${shard.id} is ready!`,
          `🌐 Connection established`,
          `⚡ Processing events`,
        ]);
      });

      shard.on("death", () => {
        Logger.error(`💀 Shard #${shard.id} died unexpectedly`);
      });

      shard.on("error", (error) => {
        Logger.error(`❌ Shard #${shard.id} error:`, error);
      });
    });
  }

  public async spawn(): Promise<void> {
    try {
      Logger.info("🚀 Spawning shards...");
      await this.manager.spawn();
      Logger.success("✨ All shards spawned successfully!");
    } catch (error) {
      Logger.fatal("Failed to spawn shards:", error);
      process.exit(1);
    }
  }
}
