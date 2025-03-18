import { Command } from "../../types/Command";
import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
} from "discord.js";
import { spawn } from "child_process";
import { Logger } from "../../utils/logger";
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
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command to execute")
        .setRequired(true),
    ),

  // Add prefix command configuration
  prefix: {
    aliases: ["shell", "sh", "cmd", "exec"],
    usage: "<command>", // Example: jam!shell ls -la
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

    // Get command to execute
    let command: string;
    if (isPrefix) {
      const args = (interaction as Message).content
        .slice(process.env.PREFIX?.length || 0)
        .trim()
        .split(/ +/g)
        .slice(1)
        .join(" ");

      if (!args) {
        await (interaction as Message).reply(
          "Please specify a command to execute",
        );
        return;
      }
      command = args;
      await (interaction as Message).channel.sendTyping();
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
      command = (interaction as ChatInputCommandInteraction).options.getString(
        "command",
        true,
      );
    }

    Logger.command(
      `Executed shell for ${isPrefix ? (interaction as Message).author.username : (interaction as ChatInputCommandInteraction).user.username}.`,
    );

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

        if (isPrefix) {
          await (interaction as Message).reply({
            content: `**System Information:**\n\`\`\`ansi\n${output}\`\`\``,
          });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            content: `**System Information:**\n\`\`\`ansi\n${output}\`\`\``,
          });
        }
        return;
      }

      // Regular command handling
      const args = command.split(" ");
      const program = args.shift()!;

      const childProcess = spawn(program, args, {
        shell: true,
        env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "true" },
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

        if (isPrefix) {
          await (interaction as Message).reply(chunks[0]);
          for (let i = 1; i < chunks.length; i++) {
            await (interaction as Message).channel.send(chunks[i]);
          }
        } else {
          await (interaction as ChatInputCommandInteraction).editReply(
            chunks[0],
          );
          for (let i = 1; i < chunks.length; i++) {
            await (interaction as ChatInputCommandInteraction).followUp({
              content: chunks[i],
              ephemeral: true,
            });
          }
        }
      } else {
        if (isPrefix) {
          await (interaction as Message).reply(response);
        } else {
          await (interaction as ChatInputCommandInteraction).editReply(
            response,
          );
        }
      }
    } catch (error) {
      Logger.error("Shell command error:", error);
      const errorResponse = `❌ Error executing command:\n\`\`\`\n${error}\`\`\``;

      if (isPrefix) {
        await (interaction as Message).reply(errorResponse);
      } else {
        await (interaction as ChatInputCommandInteraction).editReply(
          errorResponse,
        );
      }
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
