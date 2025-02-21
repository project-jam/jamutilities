import "dotenv/config";
import { ShardHandler } from "./src/handlers/shardHandler";

const shardHandler = new ShardHandler();
shardHandler.spawn().catch((error) => {
  console.error("Failed to spawn shards:", error);
  process.exit(1);
});
