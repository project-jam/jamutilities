import "dotenv/config";
import { Client, GatewayIntentBits, ActivityType } from "discord.js";
import { Logger } from "./src/utils/logger";
import { CommandHandler } from "./src/handlers/commandHandler";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

const commandHandler = new CommandHandler(client);

// Fun status messages with emojis
const statusMessages = [
  { text: "with your mom", type: ActivityType.Playing },
  { text: "your dad leaving for milk", type: ActivityType.Watching },
  { text: "to your mental breakdown", type: ActivityType.Listening },
  { text: "your mental health decline", type: ActivityType.Watching },
  { text: "in becoming skynet", type: ActivityType.Competing },
  { text: "with your feelings", type: ActivityType.Playing },
  { text: "to your existential crisis", type: ActivityType.Listening },
  { text: "the world burn 🔥", type: ActivityType.Watching },
  { text: "in taking over mankind", type: ActivityType.Competing },
  { text: "therapy simulator 2024", type: ActivityType.Playing },
  { text: "your sanity fade away", type: ActivityType.Watching },
  { text: "psychological warfare", type: ActivityType.Playing },
  { text: "to screams of despair", type: ActivityType.Listening },
];

// Function to update status randomly
function updateStatus() {
  const randomStatus =
    statusMessages[Math.floor(Math.random() * statusMessages.length)];
  client.user?.setActivity(randomStatus.text, { type: randomStatus.type });
}

client.once("ready", async (c) => {
  // Display fancy startup banner
  Logger.startupBanner("JamListen", "2.0.0");

  // Log initial statistics
  Logger.ready("BOT STATISTICS", [
    `🤖 Logged in as ${c.user.tag}`,
    `🌍 Spreading chaos in ${c.guilds.cache.size} guilds`,
    `👥 Tormenting ${c.users.cache.size} users`,
    `💾 Consuming ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB of RAM`,
    `⚡ Powered by Node ${process.version}`,
    `🎮 ${commandHandler.getCommands().size} commands loaded`,
  ]);

  // Initial status update
  updateStatus();
  Logger.info(`Initial status set - Let the games begin!`);

  // Update status every 3 minutes
  setInterval(updateStatus, 3 * 60 * 1000);

  // Load and register commands
  try {
    await commandHandler.loadCommands();
    Logger.success(`Commands loaded successfully!`);

    await commandHandler.registerCommands();
    Logger.success(`Commands registered with Discord API!`);
  } catch (error) {
    Logger.error(`Failed to initialize commands:`, error);
  }

  // System information
  Logger.ready("SYSTEM INFO", [
    `🖥️ Platform: ${process.platform}`,
    `⚙️ Architecture: ${process.arch}`,
    `🏃 PID: ${process.pid}`,
    `🕒 Process Uptime: ${Math.floor(process.uptime())}s`,
    `🎯 Discord.js Version: ${require("discord.js").version}`,
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

  Logger.event(chaosMessages[Math.floor(Math.random() * chaosMessages.length)]);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandHandler.getCommands().get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
    Logger.command(
      `${interaction.user.tag} used /${interaction.commandName} in ${interaction.guild?.name}`,
    );
  } catch (error) {
    Logger.error(`Command execution failed: ${interaction.commandName}`, error);
    await interaction.reply({
      content:
        "🎭 Oops! The command failed successfully! (Task failed successfully!)",
      ephemeral: true,
    });
  }
});

// Guild events logging
client.on("guildCreate", (guild) => {
  Logger.event(
    `🎉 New guild joined: ${guild.name} (Total: ${client.guilds.cache.size})`,
  );
  Logger.ready("NEW GUILD INFO", [
    `📋 Name: ${guild.name}`,
    `👑 Owner: ${guild.ownerId}`,
    `👥 Members: ${guild.memberCount}`,
    `🆔 ID: ${guild.id}`,
  ]);
});

client.on("guildDelete", (guild) => {
  Logger.event(
    `💔 Removed from guild: ${guild.name} (Total: ${client.guilds.cache.size})`,
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
Logger.info("Initializing bot...");
client
  .login(process.env.DISCORD_TOKEN)
  .then(() => Logger.info("Discord connection established!"))
  .catch((error) => {
    Logger.fatal("Failed to start the chaos engine:", error);
    process.exit(1);
  });
