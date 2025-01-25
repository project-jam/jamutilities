import { Command } from "../types/Command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { spawn } from "child_process";
import { Logger } from "../utils/logger";
import ansi from "ansi-to-html";

const converter = new ansi({
  fg: "#FFF",
  bg: "#000",
  newline: true,
  escapeXML: true,
  stream: true,
});

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shell")
    .setDescription("Executes a shell command (Owner only)")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command to execute")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      await interaction.reply({
        content: "❌ This command is restricted to the bot owner only!",
        flags: ["Ephemeral"],
      });
      return;
    }

    const command = interaction.options.getString("command");
    if (!command) {
      await interaction.reply({
        content: "Please specify a command",
        flags: ["Ephemeral"],
      });
      return;
    }

    await interaction.deferReply();
    Logger.command(`Executed shell for ${interaction.user.username}.`);

    try {
      // Special handling for neofetch
      if (command.includes("neofetch")) {
        const neofetch = spawn("neofetch", ["--stdout"], {
          env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "true" },
        });

        let output = "";

        neofetch.stdout.on("data", (data) => {
          output += data.toString();
        });

        await new Promise((resolve) => {
          neofetch.on("close", resolve);
        });

        // Convert ANSI to HTML and wrap in a code block
        const htmlOutput = converter.toHtml(output);

        await interaction.editReply({
          content: `**System Information:**\n\`\`\`ansi\n${output}\`\`\``,
        });
        return;
      }

      // Regular command handling
      const args = command.split(" ");
      const program = args.shift()!;

      const childProcess = spawn(program, args, {
        shell: true,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          FORCE_COLOR: "true",
        },
      });

      let stdout = "";
      let stderr = "";

      childProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      await new Promise((resolve, reject) => {
        childProcess.on("close", (code) => {
          if (code === 0 || code === null) {
            resolve(code);
          } else {
            reject(new Error(`Process exited with code ${code}`));
          }
        });

        childProcess.on("error", reject);

        setTimeout(() => {
          childProcess.kill();
          resolve("timeout");
        }, 10000);
      });

      let response = "";
      if (stdout) {
        response += `📤 Output:\n\`\`\`ansi\n${stdout}\`\`\`\n`;
      }
      if (stderr) {
        response += `⚠️ Error:\n\`\`\`ansi\n${stderr}\`\`\`\n`;
      }

      if (!response)
        response = "✅ Command executed successfully with no output";

      // Handle long responses
      if (response.length > 2000) {
        const chunks = splitResponse(response);
        await interaction.editReply(chunks[0]);

        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp({
            content: chunks[i],
            flags: ["Ephemeral"],
          });
        }
      } else {
        await interaction.editReply(response);
      }
    } catch (error) {
      Logger.error("Shell command error:", error);
      await interaction.editReply({
        content: `❌ Error executing command:\n\`\`\`\n${error}\`\`\``,
      });
    }
  },
};

// Helper function to split long responses while preserving code blocks
function splitResponse(response: string, maxLength = 1950): string[] {
  const chunks: string[] = [];
  let current = "";
  const lines = response.split("\n");

  let isInCodeBlock = false;

  for (const line of lines) {
    if (line.includes("```")) {
      isInCodeBlock = !isInCodeBlock;
    }

    if (current.length + line.length + 1 > maxLength) {
      if (isInCodeBlock) {
        current += "```\n";
        chunks.push(current);
        current = "```ansi\n" + line + "\n";
      } else {
        chunks.push(current);
        current = line + "\n";
      }
    } else {
      current += line + "\n";
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
