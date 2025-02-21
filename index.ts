import "dotenv/config";
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

// Check for required environment variables
if (!process.env.DISCORD_TOKEN) {
  Logger.fatal("$ Missing DISCORD_TOKEN in environment variables");
  process.exit(1);
}

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

// Fun status messages with dev-friendly themes
const statusMessages = [
  { text: "$ git checkout happiness", type: ActivityType.Playing },
  { text: "$ npm run chaos", type: ActivityType.Playing },
  { text: "$ docker compose up love", type: ActivityType.Playing },
  { text: "$ sudo make friends", type: ActivityType.Playing },
  { text: "$ ping -t happiness", type: ActivityType.Playing },
  { text: "$ git push --force hugs", type: ActivityType.Playing },
  { text: "$ yarn add @friends/love", type: ActivityType.Playing },
  { text: "$ bun install happiness", type: ActivityType.Playing },
  { text: "./chaos_script.sh", type: ActivityType.Playing },
  { text: "$ systemctl start fun", type: ActivityType.Playing },
  { text: "SELECT * FROM friends;", type: ActivityType.Playing },
  { text: "$ echo 'Hello World!'", type: ActivityType.Playing },
  { text: "import { happiness }", type: ActivityType.Playing },
  { text: "while true; do love;", type: ActivityType.Playing },
  { text: "$ chmod +x fun.sh", type: ActivityType.Playing },
];

function updateStatus() {
  const randomStatus =
    statusMessages[Math.floor(Math.random() * statusMessages.length)];
  client.user?.setActivity(randomStatus.text, { type: randomStatus.type });
}

client.once("ready", async (c) => {
  const shardId = client.shard?.ids[0] ?? 0;
  const totalShards = client.shard?.count ?? 1;

  let [guildsCount, usersCount] = [0, 0];

  if (client.shard) {
    try {
      const promises = [
        client.shard.fetchClientValues("guilds.cache.size"),
        client.shard.broadcastEval((c) =>
          c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
        ),
      ];

      const results = await Promise.all(promises);
      guildsCount = (results[0] as number[]).reduce(
        (acc, guildCount) => acc + guildCount,
        0,
      );
      usersCount = (results[1] as number[]).reduce(
        (acc, memberCount) => acc + memberCount,
        0,
      );
    } catch (error) {
      Logger.error("$ ERROR: Failed to fetch shard statistics", error);
      guildsCount = client.guilds.cache.size;
      usersCount = client.users.cache.size;
    }
  } else {
    guildsCount = client.guilds.cache.size;
    usersCount = client.users.cache.size;
  }

  Logger.startupBanner(`JamListen v2.0.0 [Shard ${shardId}]`, [
    "$ initializing systems...",
    "$ loading modules...",
    "$ importing chaos...",
    "$ deployment successful!",
  ]);

  BlacklistManager.getInstance();
  Logger.info("$ blacklist.service started successfully");

  Logger.ready("SYSTEM STATUS", [
    `$ whoami: ${c.user.tag}`,
    `$ shard: ${shardId + 1}/${totalShards}`,
    `$ guilds: ${guildsCount}`,
    `$ users: ${usersCount}`,
    `$ memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
    `$ runtime: Node ${process.version}`,
    `$ modules: ${commandHandler.getCommands().size} loaded`,
  ]);

  updateStatus();
  Logger.info(`$ status.service initialized`);

  setInterval(updateStatus, 3 * 60 * 1000);

  try {
    await commandHandler.loadCommands();
    Logger.success(`$ commands.service: All modules imported successfully`);

    await commandHandler.registerCommands();
    Logger.success(`$ api.service: Command registration complete`);
  } catch (error) {
    Logger.error(`$ ERROR: Command initialization failed:`, error);
  }

  Logger.ready("ENVIRONMENT", [
    `$ OS: ${process.platform}`,
    `$ ARCH: ${process.arch}`,
    `$ PID: ${process.pid}`,
    `$ UPTIME: ${Math.floor(process.uptime())}s`,
    `$ DISCORD.JS: v${require("discord.js").version}`,
  ]);

  const bootMessages = [
    "$ chaos.service started successfully",
    "$ fun.service is now active",
    "$ initialized primary chaos generators",
    "$ deployment completed with 0 errors",
    "$ system is ready for some trolling",
    "$ sudo systemctl start happiness",
    "$ imported all necessary chaos modules",
    "$ git checkout main --force",
    "$ npm run start:chaos",
    "$ docker compose up friendship",
  ];

  Logger.event(bootMessages[Math.floor(Math.random() * bootMessages.length)]);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

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
            .setTitle("$ Access Denied")
            .setDescription("```diff\n- Error: User is blacklisted\n```")
            .addFields(
              {
                name: "$ whoami",
                value: blacklistInfo?.username || "Unknown",
                inline: true,
              },
              {
                name: "$ reason",
                value: blacklistInfo?.reason || "No reason provided",
                inline: true,
              },
              {
                name: "$ date",
                value: blacklistInfo
                  ? `<t:${Math.floor(blacklistInfo.timestamp / 1000)}:R>`
                  : "Unknown",
                inline: true,
              },
            )
            .setFooter({
              text: "$ contact admin for support",
            }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const command = commandHandler.getCommands().get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
    Logger.command(
      `$ ${interaction.user.tag} executed /${interaction.commandName} in ${interaction.guild?.name}`,
    );
  } catch (error) {
    Logger.error(
      `$ command.service: Execution failed: ${interaction.commandName}`,
      error,
    );
    await interaction.reply({
      content: "```diff\n- Error: Task failed successfully!\n```",
      flags: MessageFlags.Ephemeral,
    });
  }
});

client.on("guildCreate", (guild) => {
  Logger.event(
    `$ guild.service: New server joined: ${guild.name} (Total: ${client.guilds.cache.size})`,
  );
  Logger.ready("GUILD INFO", [
    `$ name: ${guild.name}`,
    `$ owner: ${guild.ownerId}`,
    `$ members: ${guild.memberCount}`,
    `$ id: ${guild.id}`,
  ]);
});

client.on("guildDelete", (guild) => {
  Logger.event(
    `$ guild.service: Server removed: ${guild.name} (Total: ${client.guilds.cache.size})`,
  );
});

client.on("error", (error) => {
  Logger.error("$ discord.service: Client error occurred:", error);
});

process.on("unhandledRejection", (error) => {
  Logger.error("$ process: Unhandled Promise Rejection:", error);
});

process.on("uncaughtException", (error) => {
  Logger.fatal("$ process: Fatal Exception (Restarting):", error);
});

process.on("SIGINT", () => {
  Logger.warn("$ process: Received SIGINT. Cleaning up...");
  BlacklistManager.getInstance().cleanup();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  Logger.warn("$ process: Received SIGTERM. Cleaning up...");
  BlacklistManager.getInstance().cleanup();
  client.destroy();
  process.exit(0);
});

Logger.info("$ system: Initializing main process...");
client
  .login(process.env.DISCORD_TOKEN)
  .then(() => Logger.info("$ discord.service: Connection established"))
  .catch((error) => {
    Logger.fatal("$ system: Failed to initialize:", error);
    process.exit(1);
  });
