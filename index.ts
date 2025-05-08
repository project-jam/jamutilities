import {
    Client,
    GatewayIntentBits,
    ActivityType,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import { Logger } from "./src/utils/logger";
import { CommandHandler } from "./src/handlers/commandHandler";
import { BlacklistManager } from "./src/handlers/blacklistMembers";
// import { DistubeHandler } from "./src/handlers/distubeHandler";
import "dotenv/config";

// Add CommandHandler to Client type
declare module "discord.js" {
    interface Client {
        commandHandler: CommandHandler;
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
    ],
});

// Attach command handler to client
const commandHandler = new CommandHandler(client);
client.commandHandler = commandHandler;

// Run distube w/ the client itself (no don't)
// DistubeHandler.getInstance(client);

// Fun status messages with emojis
const statusMessages = [
    { text: "for new members 👋", type: ActivityType.Watching },
    { text: "git push --force 💻", type: ActivityType.Watching },
    { text: "hugs being shared 🤗", type: ActivityType.Watching },
    { text: "kisses being blown 💋", type: ActivityType.Watching },
    { text: "air kisses flying ✨", type: ActivityType.Watching },
    { text: "waves to members 👋", type: ActivityType.Watching },
    { text: "the server grow 🌱", type: ActivityType.Watching },
    { text: "commit messages 🖥️", type: ActivityType.Watching },
];

function updateStatus() {
    const randomStatus =
        statusMessages[Math.floor(Math.random() * statusMessages.length)];
    client.user?.setActivity(randomStatus.text, { type: randomStatus.type });
}

client.once("ready", async (c) => {
    const shardInfo = client.shard
        ? ` on shard [${client.shard.ids.join(", ")}]`
        : "";
    Logger.startupBanner("JamUtilities", "2.0.0");

    BlacklistManager.getInstance();
    Logger.info("Blacklist manager initialized");

    Logger.ready(
        "BOT STATISTICS",
        [
            `🤖 Logged in as ${c.user.tag}${shardInfo}`,
            `🌍 Spreading chaos in ${c.guilds.cache.size} guilds`,
            `👥 Tormenting ${c.users.cache.size} users`,
            `💾 Consuming ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB of RAM`,
            `⚡ Powered by Node ${process.version}`,
            `🎮 ${client.commandHandler.getCommands().size} commands loaded`,
            `🔧 Command Modes:`,
            `   • Slash Commands: ${client.commandHandler.isSlashEnabled() ? "✅" : "❌"}`,
            `   • Prefix Commands: ${client.commandHandler.isPrefixEnabled() ? "✅" : "❌"}`,
            client.commandHandler.isPrefixEnabled()
                ? `   • Prefix: ${client.commandHandler.getPrefix()}`
                : "",
        ].filter(Boolean),
    );

    updateStatus();
    Logger.info(`Initial status set - Let the games begin!`);

    try {
        await client.commandHandler.loadCommands();
        Logger.success(`Commands loaded successfully!`);

        if (client.commandHandler.isSlashEnabled()) {
            await client.commandHandler.registerCommands();
            Logger.success(`Commands registered with Discord API!`);
        }
    } catch (error) {
        Logger.fatal("Failed to initialize commands: ", error);
        process.exit(1);
    }

    Logger.ready("SYSTEM INFO", [
        `🖥️ Platform: ${process.platform}`,
        `⚙️ Architecture: ${process.arch}`,
        `🏃 PID: ${process.pid}`,
        `🕒 Process Uptime: ${Math.floor(process.uptime())}s`,
        `🎯 Discord.js Version: ${require("discord.js").version}`,
    ]);

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

// Handle Slash Commands
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Skip blacklist check for owner
    if (interaction.user.id !== process.env.OWNER_ID) {
        const blacklistManager = BlacklistManager.getInstance();
        if (blacklistManager.isBlacklisted(interaction.user.id)) {
            const blacklistInfo = blacklistManager.getBlacklistInfo(
                interaction.user.id,
            );
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ff3838")
                        .setTitle("Access Denied")
                        .setDescription(
                            "You are blacklisted from using this bot.",
                        )
                        .addFields(
                            {
                                name: "Username",
                                value: blacklistInfo?.username || "Unknown",
                                inline: true,
                            },
                            {
                                name: "Reason",
                                value:
                                    blacklistInfo?.reason ||
                                    "No reason provided",
                                inline: true,
                            },
                            {
                                name: "Blacklisted Since",
                                value: `<t:${Math.floor(blacklistInfo!.timestamp)}:R>`,
                                inline: true,
                            },
                        )
                        .setFooter({
                            text: "Contact the bot owner if you think this is a mistake",
                        }),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
    }

    await client.commandHandler.handleCommand(interaction);
});

// Handle Prefix Commands
client.on("messageCreate", async (message) => {
    // First check if message starts with prefix or is from a bot
    if (
        !message.content.startsWith(process.env.PREFIX || "jam!") ||
        message.author.bot
    )
        return;

    // Then check blacklist for non-owner users
    if (message.author.id !== process.env.OWNER_ID) {
        const blacklistManager = BlacklistManager.getInstance();
        if (blacklistManager.isBlacklisted(message.author.id)) {
            const blacklistInfo = blacklistManager.getBlacklistInfo(
                message.author.id,
            );
            await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ff3838")
                        .setTitle("Access Denied")
                        .setDescription(
                            "You are blacklisted from using this bot.",
                        )
                        .addFields(
                            {
                                name: "Username",
                                value: blacklistInfo?.username || "Unknown",
                                inline: true,
                            },
                            {
                                name: "Reason",
                                value:
                                    blacklistInfo?.reason ||
                                    "No reason provided",
                                inline: true,
                            },
                            {
                                name: "Blacklisted Since",
                                value: `<t:${Math.floor(blacklistInfo!.timestamp)}:R>`,
                                inline: true,
                            },
                        )
                        .setFooter({
                            text: "Contact the bot owner if you think this is a mistake",
                        }),
                ],
            });
            return;
        }
    }

    await client.commandHandler.handlePrefixCommand(message);
});

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

client.on("error", (error) => {
    Logger.fatal("Discord client error occurred: ", error);
});

process.on("unhandledRejection", (error) => {
    Logger.fatal("☆ Unhandled Promise Rejection: ", error);
});

process.on("uncaughtException", (error) => {
    Logger.fatal("🔥 Uncaught Exception (Bot will restart): ", error);
});

process.on("SIGINT", () => {
    Logger.warn("Received SIGINT signal. Cleaning up...");
    BlacklistManager.getInstance().cleanup();
    client.destroy();
    process.exit(0);
});

process.on("SIGTERM", () => {
    Logger.warn("Received SIGTERM signal. Cleaning up...");
    BlacklistManager.getInstance().cleanup();
    client.destroy();
    process.exit(0);
});

// Status update interval
setInterval(updateStatus, 3 * 60 * 1000); // Every 3 minutes

Logger.info("Initializing bot...");
client
    .login(process.env.DISCORD_TOKEN)
    .then(() => Logger.info("Discord connection established!"))
    .catch((error) => {
        Logger.fatal("Failed to start the chaos engine: ", error);
        process.exit(1);
    });
