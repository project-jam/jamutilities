import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  version as discordVersion,
  PresenceStatus,
} from "discord.js";
import { execSync } from "child_process";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import os from "os";
import process from "process";

function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

function getCPUUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  return ((1 - totalIdle / totalTick) * 100).toFixed(1) as unknown as number;
}

function getOSEmoji(platform: string): string {
  switch (platform.toLowerCase()) {
    case "win32":
      return "🪟";
    case "darwin":
      return "🍎";
    case "linux":
      return "🐧";
    default:
      return "💻";
  }
}

function getStatusEmoji(status: PresenceStatus): string {
  switch (status) {
    case "online":
      return "🟢";
    case "idle":
      return "🟡";
    case "dnd":
      return "🔴";
    case "invisible":
      return "⚫";
    default:
      return "⚪";
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Shows detailed bot status and system information"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      await interaction.reply({
        content: "❌ This command is restricted to the bot owner only!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // Get Node.js version and package versions
      const nodeVersion = process.version;
      const packageJson = require("../../../package.json");

      // Get Bun version
      let bunVersion = "Not installed";
      try {
        bunVersion = execSync("bun --version").toString().trim();
      } catch (error) {
        Logger.warn("Bun is not installed or not accessible");
      }

      // Get system information
      const osType = os.type();
      const osRelease = os.release();
      const osPlatform = os.platform();
      const osArch = os.arch();
      const osUptime = os.uptime();

      // Get memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = process.memoryUsage();

      // Get CPU information
      const cpuModel = os.cpus()[0].model;
      const cpuCount = os.cpus().length;
      const cpuUsage = getCPUUsage();

      // Get network interfaces
      const nets = os.networkInterfaces();
      const networkInterfaces = Object.keys(nets).length;

      // Get bot statistics
      const botUptime = process.uptime();
      const client = interaction.client;
      const totalMembers = client.guilds.cache.reduce(
        (acc, guild) => acc + guild.memberCount,
        0,
      );
      const channels = client.channels.cache.size;
      const totalEmojis = client.emojis.cache.size;
      const commandsCount = client.application?.commands.cache.size || 0;

      // Get process information
      const pid = process.pid;
      const processUptime = process.uptime();

      // Calculate bot statistics
      const averageMembersPerGuild = (
        totalMembers / client.guilds.cache.size
      ).toFixed(2);
      const averageChannelsPerGuild = (
        channels / client.guilds.cache.size
      ).toFixed(2);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle(`${client.user?.username}'s Status`)
        .setThumbnail(client.user?.displayAvatarURL() || "")
        .addFields(
          {
            name: "🔧 Versions",
            value: [
              `**Discord.js:** v${discordVersion}`,
              `**Node.js:** ${nodeVersion}`,
              `**Bun:** ${bunVersion}`,
              `**Bot Version:** v${packageJson.version || "1.0.0"}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "💻 System",
            value: [
              `**OS:** ${getOSEmoji(osPlatform)} ${osType} (${osPlatform} ${osRelease})`,
              `**Architecture:** ${osArch}`,
              `**CPU:** ${cpuModel}`,
              `**CPU Cores:** ${cpuCount}`,
              `**CPU Usage:** ${cpuUsage}%`,
              `**System Uptime:** ${formatUptime(osUptime)}`,
              `**Network Interfaces:** ${networkInterfaces}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "📊 Memory",
            value: [
              `**Total:** ${formatBytes(totalMem)}`,
              `**Used:** ${formatBytes(usedMem)} (${((usedMem / totalMem) * 100).toFixed(1)}%)`,
              `**Free:** ${formatBytes(freeMem)}`,
              `**Bot Heap:** ${formatBytes(memoryUsage.heapUsed)} / ${formatBytes(memoryUsage.heapTotal)}`,
              `**Bot RSS:** ${formatBytes(memoryUsage.rss)}`,
              `**External:** ${formatBytes(memoryUsage.external)}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "⏰ Time Information",
            value: [
              `**Bot Uptime:** ${formatUptime(botUptime)}`,
              `**Process Uptime:** ${formatUptime(processUptime)}`,
              `**Process ID:** ${pid}`,
              `**System Time:** ${new Date().toLocaleString()}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "🤖 Bot Statistics",
            value: [
              `**Status:** ${getStatusEmoji(client.presence.status)} ${client.presence.status}`,
              `**Guilds:** ${client.guilds.cache.size}`,
              `**Users:** ${totalMembers}`,
              `**Channels:** ${channels}`,
              `**Emojis:** ${totalEmojis}`,
              `**Commands:** ${commandsCount}`,
              `**Avg. Members/Guild:** ${averageMembersPerGuild}`,
              `**Avg. Channels/Guild:** ${averageChannelsPerGuild}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "🌐 Connection",
            value: [
              `**Ping:** ${client.ws.ping}ms`,
              `**Shard Count:** ${client.shard?.count || 1}`,
              `**API Version:** ${client.options.rest?.version || "9"}`,
            ].join("\n"),
            inline: false,
          },
        )
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.tag} | PID: ${process.pid}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Status command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ An error occurred while fetching status information.",
            ),
        ],
      });
    }
  },
};
