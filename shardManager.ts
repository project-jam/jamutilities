import { ShardHandler } from "./src/handlers/shardHandler";

const shardHandler = new ShardHandler();
shardHandler.spawn().catch(console.error);
