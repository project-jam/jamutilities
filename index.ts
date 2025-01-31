import "dotenv/config";

import { Client, GatewayIntentBits } from "discord.js";
import { DisTube } from "distube";
import { SoundCloudPlugin } from "@distube/soundcloud";
import { YtDlpPlugin } from "@distube/yt-dlp";
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

client.distube = new DisTube(client, {
  plugins: [new SoundCloudPlugin(), new YtDlpPlugin()],
});

client.distube.on("playSong", (queue, song) => {
  Logger.info(`Playing: ${song.name}`);
});

client.distube.on("error", (channel, error) => {
  Logger.error(`DisTube error: ${error.message}`);
});

const commandHandler = new CommandHandler(client);

client.once("ready", async (c) => {
  Logger.success(`Logged in as ${c.user.tag}`);
  await commandHandler.loadCommands();
  await commandHandler.registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commandHandler.getCommands().get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
    Logger.command(
      `Executed ${interaction.commandName} for ${interaction.user.tag}`,
    );
  } catch (error) {
    Logger.error(`Error executing ${interaction.commandName}:`, error);
    await interaction.reply({
      content: "There was an error executing this command!",
      ephemeral: true,
    });
  }
});

client.on("error", (error) => {
  Logger.error("Client error:", error);
});

client.login(process.env.DISCORD_TOKEN);
