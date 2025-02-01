import "dotenv/config";

import { Client, GatewayIntentBits, ActivityType } from "discord.js";
import { Logger } from "./src/utils/logger";
import { CommandHandler } from "./src/handlers/commandHandler";
import { ShardHandler } from "./src/handlers/shardHandler";

// Check if the process is the shard manager
if (process.env.SHARDING_MANAGER) {
  // Initialize and start the shard manager
  const shardHandler = new ShardHandler();
  shardHandler.spawn();
} else {
  // This is a shard process
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
    ],
    shards: "auto",
  });

  const commandHandler = new CommandHandler(client);

  // Fun status messages with emojis
  const statusMessages = [
    { text: "for new members 👋", type: ActivityType.Watching },
    { text: "git push --force 💻", type: ActivityType.Watching },
    { text: "hugs being shared 🤗", type: ActivityType.Watching },
    { text: "kisses being blown 💋", type: ActivityType.Watching },
    { text: "air kisses flying ✨", type: ActivityType.Watching },
    { text: "waves to members 👋", type: ActivityType.Watching },
    { text: "the server grow 📈", type: ActivityType.Watching },
    { text: "commit messages 🖥️", type: ActivityType.Watching },
    { text: "devious plans 😈", type: ActivityType.Watching },
    { text: "evil laughs 🦹", type: ActivityType.Listening },
    { text: "coins being flipped 🪙", type: ActivityType.Watching },
    { text: "tickets being made ✉️", type: ActivityType.Watching },
    { text: "with moderation ⚔️", type: ActivityType.Playing },
    { text: "server stats 📊", type: ActivityType.Watching },
    { text: "git pull origin main", type: ActivityType.Playing },
    { text: "npm install success ✅", type: ActivityType.Watching },
    { text: "bun install --force", type: ActivityType.Playing },
    { text: "moderators at work 🛡️", type: ActivityType.Watching },
    { text: "members having fun 🎮", type: ActivityType.Watching },
    { text: "the chat flow 💭", type: ActivityType.Watching },
  ];

  // Function to update status randomly
  function updateStatus() {
    const randomStatus =
      statusMessages[Math.floor(Math.random() * statusMessages.length)];
    client.user?.setActivity(randomStatus.text, { type: randomStatus.type });
  }

  client.once("ready", async (c) => {
    // Display fancy startup banner with shard info
    Logger.startupBanner("JamListen", "2.0.0");

    // Log initial statistics with shard information
    Logger.ready("BOT STATISTICS", [
      `🤖 Logged in as ${c.user.tag}`,
      `🔷 Shard ${c.shard?.ids[0]} of ${c.shard?.count}`,
      `🌍 Spreading chaos in ${c.guilds.cache.size} guilds`,
      `👥 Tormenting ${c.users.cache.size} users`,
      `💾 Consuming ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB of RAM`,
      `⚡ Powered by Node ${process.version}`,
      `🎮 ${commandHandler.getCommands().size} commands loaded`,
    ]);

    // Initial status update
    updateStatus();
    Logger.info(
      `Initial status set - Let the games begin! (Shard ${c.shard?.ids[0]})`,
    );

    // Update status every 3 minutes
    setInterval(updateStatus, 3 * 60 * 1000);

    // Load and register commands
    try {
      await commandHandler.loadCommands();
      Logger.success(
        `Commands loaded successfully! (Shard ${c.shard?.ids[0]})`,
      );

      await commandHandler.registerCommands();
      Logger.success(
        `Commands registered with Discord API! (Shard ${c.shard?.ids[0]})`,
      );
    } catch (error) {
      Logger.error(
        `Failed to initialize commands (Shard ${c.shard?.ids[0]}):`,
        error,
      );
    }

    // System information
    Logger.ready("SYSTEM INFO", [
      `🖥️ Platform: ${process.platform}`,
      `⚙️ Architecture: ${process.arch}`,
      `🏃 PID: ${process.pid}`,
      `🕒 Process Uptime: ${Math.floor(process.uptime())}s`,
      `🎯 Discord.js Version: ${require("discord.js").version}`,
      `💠 Shard ID: ${c.shard?.ids[0]}/${c.shard?.count}`,
    ]);

    // Ready to cause chaos!
    const chaosMessages = [
      "🤖 Beep boop, time to ruin someone's day!",
      "💀 Ready to cause psychological damage!",
      "🎭 Time to play with human emotions!",
      "🌪️ Chaos mode activated successfully!",
      "🔥 Ready to set the world on fire!",
      "🎪 Let the circus begin!",
      "🃏 The Joker has entered the chat!",
      "🎮 Game on, prepare for trouble!",
      "💫 Chaos generator initialized!",
      "🌈 Ready to spread colorful destruction!",
    ];

    Logger.event(
      chaosMessages[Math.floor(Math.random() * chaosMessages.length)],
    );
  });

  // Shard-specific events
  client.on("shardError", (error, shardId) => {
    Logger.error(`Shard ${shardId} encountered an error:`, error);
  });

  client.on("shardReady", (shardId, unavailableGuilds) => {
    Logger.success(`Shard ${shardId} is ready!`);
    if (unavailableGuilds) {
      Logger.warn(
        `Shard ${shardId} has ${unavailableGuilds.size} unavailable guilds`,
      );
    }
  });

  client.on("shardDisconnect", (event, shardId) => {
    Logger.warn(`Shard ${shardId} disconnected!`);
  });

  client.on("shardReconnecting", (shardId) => {
    Logger.info(`Shard ${shardId} reconnecting...`);
  });

  client.on("shardResume", (shardId, replayedEvents) => {
    Logger.success(
      `Shard ${shardId} resumed! Replayed ${replayedEvents} events.`,
    );
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commandHandler.getCommands().get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
      Logger.command(
        `${interaction.user.tag} used /${interaction.commandName} in ${interaction.guild?.name} (Shard ${interaction.guild?.shardId})`,
      );
    } catch (error) {
      Logger.error(
        `Command execution failed: ${interaction.commandName}`,
        error,
      );
      await interaction.reply({
        content:
          "🎭 Oops! The command failed successfully! (Task failed successfully!)",
        ephemeral: true,
      });
    }
  });

  // Guild events logging with shard information
  client.on("guildCreate", (guild) => {
    Logger.event(
      `🎉 New guild joined: ${guild.name} (Total: ${client.guilds.cache.size}) [Shard ${guild.shardId}]`,
    );
    Logger.ready("NEW GUILD INFO", [
      `📋 Name: ${guild.name}`,
      `👑 Owner: ${guild.ownerId}`,
      `👥 Members: ${guild.memberCount}`,
      `🆔 ID: ${guild.id}`,
      `💠 Shard: ${guild.shardId}`,
    ]);
  });

  client.on("guildDelete", (guild) => {
    Logger.event(
      `💔 Removed from guild: ${guild.name} (Total: ${client.guilds.cache.size}) [Shard ${guild.shardId}]`,
    );
  });

  // Error handling with style
  client.on("error", (error) => {
    Logger.error("Discord client error occurred:", error);
  });

  process.on("unhandledRejection", (error) => {
    Logger.error("💀 Unhandled Promise Rejection:", error);
  });

  process.on("uncaughtException", (error) => {
    Logger.fatal("🔥 Uncaught Exception (Bot will restart):", error);
  });

  // Clean shutdown handling
  process.on("SIGINT", () => {
    Logger.warn("Received SIGINT signal. Cleaning up...");
    client.destroy();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    Logger.warn("Received SIGTERM signal. Cleaning up...");
    client.destroy();
    process.exit(0);
  });

  // Initialize bot
  Logger.info(`Initializing bot on shard ${client.shard?.ids[0]}...`);
  client
    .login(process.env.DISCORD_TOKEN)
    .then(() =>
      Logger.info(
        `Discord connection established on shard ${client.shard?.ids[0]}!`,
      ),
    )
    .catch((error) => {
      Logger.fatal("Failed to start the chaos engine:", error);
      process.exit(1);
    });
}
