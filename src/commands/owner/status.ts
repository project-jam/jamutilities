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
import { statSync } from "fs";

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
    for (const type in cpu.times)
      totalTick += cpu.times[type as keyof typeof cpu.times];
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

function getDiskInfo(): string {
  try {
    const { size, free } = statSync("/");
    return `Used: ${formatBytes(size - free)} / ${formatBytes(size)}`;
  } catch {
    return "Unavailable";
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Shows detailed bot status and system information"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return await interaction.reply({
        content: "❌ This command is restricted to the bot owner only!",
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    const client = interaction.client;

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle(`${client.user?.username}'s Status`)
      .setThumbnail(client.user?.displayAvatarURL() || "")
      .addFields(
        {
          name: "🔧 Versions",
          value: `**Discord.js:** v${discordVersion}\n**Node.js:** ${process.version}\n**Bun:** ${execSync("bun --version").toString().trim() || "Not Installed"}`,
          inline: true,
        },
        {
          name: "💻 System",
          value: `**OS:** ${getOSEmoji(os.platform())} ${os.type()}\n**Arch:** ${os.arch()}\n**CPU:** ${os.cpus()[0].model}\n**Cores:** ${os.cpus().length}\n**Usage:** ${getCPUUsage()}%`,
          inline: true,
        },
        {
          name: "📊 Memory",
          value: `**Total:** ${formatBytes(os.totalmem())}\n**Used:** ${formatBytes(os.totalmem() - os.freemem())}\n**Free:** ${formatBytes(os.freemem())}`,
          inline: true,
        },
        { name: "🖴 Disk", value: getDiskInfo(), inline: true },
        {
          name: "⏰ Uptime",
          value: `**Bot:** ${formatUptime(process.uptime())}\n**System:** ${formatUptime(os.uptime())}`,
          inline: true,
        },
        {
          name: "🤖 Bot Stats",
          value: `**Status:** ${getStatusEmoji(client.presence.status)} ${client.presence.status}\n**Guilds:** ${client.guilds.cache.size}\n**Users:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
          inline: true,
        },
        {
          name: "🌐 Connection",
          value: `**Ping:** ${client.ws.ping}ms\n**Shards:** ${client.shard?.count || 1}`,
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({ embeds: [embed] });
  },
};
