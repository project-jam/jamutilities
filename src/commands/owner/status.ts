import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  version as discordVersion,
  PresenceStatus,
} from "discord.js";
import { execSync, exec } from "child_process";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import os from "os";
import process from "process";
import { promisify } from "util";
const execAsync = promisify(exec);

function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function getCPUUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0,
    totalTick = 0;
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });
  return ((1 - totalIdle / totalTick) * 100).toFixed(1) as unknown as number;
}

function getOSEmoji(platform: string): string {
  return platform.toLowerCase() === "win32"
    ? "🪟"
    : platform === "darwin"
      ? "🍎"
      : "🐧";
}

function getStatusEmoji(status: PresenceStatus): string {
  return status === "online"
    ? "🟢"
    : status === "idle"
      ? "🟡"
      : status === "dnd"
        ? "🔴"
        : "⚫";
}

async function getDiskInfo(): Promise<string[]> {
  const info: string[] = [];

  try {
    if (process.platform === "linux") {
      const { stdout } = await execAsync(
        'df -h --output=source,size,used,avail,pcent,target | grep "^/dev"',
      );
      const lines = stdout.trim().split("\n");

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          const [device, size, used, avail, usage, mountpoint] = parts;
          info.push(`💽 ${mountpoint}: ${used}/${size} (${usage} used)`);
        }
      }
    } else if (process.platform === "win32") {
      const { stdout } = await execAsync(
        "wmic logicaldisk get caption,size,freespace",
      );
      const lines = stdout.trim().split("\n").slice(1);

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const [drive, freeSpace, totalSize] = parts;
          const used = Number(totalSize) - Number(freeSpace);
          const usagePercent = ((used / Number(totalSize)) * 100).toFixed(1);
          info.push(
            `💽 ${drive}: ${formatBytes(used)}/${formatBytes(Number(totalSize))} (${usagePercent}% used)`,
          );
        }
      }
    }
  } catch (error) {
    info.push("💽 Disk info unavailable");
  }

  return info;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDMPermission(true)
    .setDescription(
      "Shows detailed bot status and system information (Owner only!)",
    ),

  // Add prefix command configuration
  prefix: {
    aliases: ["status", "stats", "botinfo", "sysinfo"],
    usage: "", // No arguments needed
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    // Check owner permission
    const userId = isPrefix
      ? (interaction as Message).author.id
      : (interaction as ChatInputCommandInteraction).user.id;
    if (userId !== process.env.OWNER_ID) {
      if (isPrefix) {
        await (interaction as Message).reply(
          "❌ This command is restricted to the bot owner only!",
        );
      } else {
        await (interaction as ChatInputCommandInteraction).reply({
          content: "❌ This command is restricted to the bot owner only!",
          ephemeral: true,
        });
      }
      return;
    }

    // Defer reply
    if (isPrefix) {
      await (interaction as Message).channel.sendTyping();
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
    }

    const client = isPrefix
      ? (interaction as Message).client
      : (interaction as ChatInputCommandInteraction).client;

    // Get disk info using the new async function
    const diskInfoLines = await getDiskInfo();
    const diskInfo = diskInfoLines.join("\n");

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle(`${client.user?.username}'s Status`)
      .setThumbnail(client.user?.displayAvatarURL() || "")
      .addFields(
        {
          name: "🔧 Versions",
          value: [
            `**Discord.js:** v${discordVersion}`,
            `**Node.js:** ${process.version}`,
            `**Bun:** ${(() => {
              try {
                return execSync("bun --version").toString().trim();
              } catch (error) {
                Logger.warn("Bun is not installed or not accessible");
                return "Not Installed";
              }
            })()}`,
            `**Platform:** ${os.type()} (${os.platform()} ${os.release()})`,
            `**Architecture:** ${os.arch()}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "💻 System",
          value: [
            `**OS:** ${getOSEmoji(os.platform())} ${os.type()}`,
            `**Architecture:** ${os.arch()}`,
            `**CPU:** ${os.cpus()[0].model}`,
            `**Cores:** ${os.cpus().length}`,
            `**Usage:** ${getCPUUsage()}%`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "📊 Memory",
          value: [
            `**Total:** ${formatBytes(os.totalmem())}`,
            `**Used:** ${formatBytes(os.totalmem() - os.freemem())}`,
            `**Free:** ${formatBytes(os.freemem())}`,
          ].join("\n"),
          inline: true,
        },
        { name: "🖴 Disk", value: diskInfo, inline: true },
        {
          name: "⏰ Uptime",
          value: [
            `**Bot:** ${formatUptime(process.uptime())}`,
            `**System:** ${formatUptime(os.uptime())}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "🤖 Bot Stats",
          value: [
            `**Status:** ${getStatusEmoji(client.presence.status)} ${client.presence.status}`,
            `**Guilds:** ${client.guilds.cache.size}`,
            `**Users:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "🌐 Connection",
          value: [
            `**Ping:** ${client.ws.ping}ms`,
            `**Shards:** ${client.shard?.count || 1}`,
          ].join("\n"),
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({
        text: `Requested by ${isPrefix ? (interaction as Message).author.tag : (interaction as ChatInputCommandInteraction).user.tag}`,
        iconURL: isPrefix
          ? (interaction as Message).author.displayAvatarURL()
          : (
              interaction as ChatInputCommandInteraction
            ).user.displayAvatarURL(),
      });

    // Send the embed
    if (isPrefix) {
      await (interaction as Message).reply({ embeds: [embed] });
    } else {
      await (interaction as ChatInputCommandInteraction).editReply({
        embeds: [embed],
      });
    }
  },
};
