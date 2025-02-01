import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  version as discordVersion,
} from "discord.js";
import { execSync } from "child_process";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import os from "os";
import process from "process";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

function formatBytes(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

async function getDiskInfo(): Promise<string[]> {
  const info: string[] = [];

  try {
    if (process.platform === "linux") {
      // For Linux systems
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
      // For Windows systems
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
      // Get Node.js version
      const nodeVersion = process.version;

      // Get Bun version
      let bunVersion = "Not installed";
      try {
        bunVersion = execSync("bun --version").toString().trim();
      } catch (error) {
        Logger.warn("Bun is not installed or not accessible");
      }

      // Get memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = process.memoryUsage();

      // Get disk information
      const diskInfo = await getDiskInfo();

      // Create embed
      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle("🤖 Bot Status")
        .addFields(
          {
            name: "🔧 Runtime",
            value: [
              `Discord.js: v${discordVersion}`,
              `Node.js: ${nodeVersion}`,
              `Bun: ${bunVersion}`,
              `Platform: ${os.type()} (${os.platform()} ${os.release()})`,
              `Architecture: ${os.arch()}`,
            ].join("\n"),
            inline: false,
          },
          {
            name: "💻 System Resources",
            value: [
              `CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)`,
              `Memory: ${formatBytes(usedMem)}/${formatBytes(totalMem)} (${((usedMem / totalMem) * 100).toFixed(1)}% used)`,
              `Process Memory: ${formatBytes(memoryUsage.heapUsed)}/${formatBytes(memoryUsage.heapTotal)}`,
              ...diskInfo,
            ].join("\n"),
            inline: false,
          },
          {
            name: "🤖 Bot Info",
            value: [
              `Guilds: ${interaction.client.guilds.cache.size}`,
              `Users: ${interaction.client.users.cache.size}`,
              `Ping: ${interaction.client.ws.ping}ms`,
              `Uptime: ${Math.floor(process.uptime())}s`,
            ].join("\n"),
            inline: false,
          },
        )
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
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
