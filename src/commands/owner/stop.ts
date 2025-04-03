import { SlashCommandBuilder } from "@discordjs/builders";
import {
    ChatInputCommandInteraction,
    Message,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";

async function cleanupFiles(): Promise<string[]> {
    const keptFiles = ["blacklist.env", ".env", "start.sh"];
    const preservedFiles: string[] = [];

    // Get the appropriate base path based on the platform
    const getBasePath = () => {
        // For pterodactyl containers
        if (process.env.CONTAINER_PATH) {
            return process.env.CONTAINER_PATH;
        }

        // For different operating systems
        switch (process.platform) {
            case "win32":
                return (
                    process.env.LOCALAPPDATA ||
                    join(homedir(), "AppData", "Local")
                );
            case "darwin":
                return join(homedir(), "Library", "Application Support");
            default: // linux and others
                return process.env.HOME || homedir();
        }
    };

    const basePath = getBasePath();

    try {
        async function removeContents(path: string) {
            const entries = await fs.readdir(path, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(path, entry.name);

                // Skip protected directories
                if (entry.isDirectory()) {
                    if (
                        entry.name === "node_modules" ||
                        entry.name === ".git" ||
                        entry.name === ".github" ||
                        entry.name === "jamutilities"
                    ) {
                        continue;
                    }

                    try {
                        await removeContents(fullPath);
                        await fs.rmdir(fullPath).catch((error) => {
                            if (error.code !== "ENOTEMPTY") {
                                Logger.error(
                                    `Failed to remove directory ${fullPath}:`,
                                    error,
                                );
                            }
                        });
                    } catch (error) {
                        Logger.error(
                            `Error processing directory ${fullPath}:`,
                            error,
                        );
                    }
                } else {
                    // Keep specified files
                    if (keptFiles.includes(entry.name)) {
                        preservedFiles.push(entry.name);
                        continue;
                    }

                    try {
                        await fs.unlink(fullPath).catch((error) => {
                            Logger.error(
                                `Failed to remove file ${fullPath}:`,
                                error,
                            );
                        });
                    } catch (error) {
                        Logger.error(`Error removing file ${fullPath}:`, error);
                    }
                }
            }
        }

        await removeContents(basePath);
        return preservedFiles;
    } catch (error) {
        Logger.error("Error during cleanup:", error);
        throw error;
    }
}

function getCurrentUTCTime(): string {
    const now = new Date();
    return now.toISOString().replace("T", " ").slice(0, 19);
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("owner")
        .setDescription("Owner-only commands")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("stop")
                .setDescription(
                    "Safely stops the bot and cleans up files (Owner only)",
                )
                .addBooleanOption((option) =>
                    option
                        .setName("force")
                        .setDescription("Force stop without graceful shutdown")
                        .setRequired(false),
                ),
        ),

    prefix: {
        aliases: ["owner"],
        usage: "owner stop [force]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        const startTime = getCurrentUTCTime();
        const executorName = isPrefix
            ? (interaction as Message).author.tag
            : (interaction as ChatInputCommandInteraction).user.tag;

        // Check owner permission
        const userId = isPrefix
            ? (interaction as Message).author.id
            : (interaction as ChatInputCommandInteraction).user.id;
        if (userId !== process.env.OWNER_ID) {
            const denyEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ This command is restricted to the bot owner only!",
                )
                .setFooter({
                    text: `Requested by ${executorName} • ${startTime} UTC`,
                });

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [denyEmbed] });
            } else {
                await (interaction as ChatInputCommandInteraction).reply({
                    embeds: [denyEmbed],
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }

        if (isPrefix) {
            // Handle prefix command
            const message = interaction as Message;
            const args = message.content.trim().split(/ +/).slice(1);
            const subCommand = args[0]?.toLowerCase();

            if (!subCommand || subCommand !== "stop") {
                await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ Invalid subcommand! Available: stop",
                            )
                            .addFields({
                                name: "Usage",
                                value: "```\njam!owner stop [force]\n```",
                            }),
                    ],
                });
                return;
            }

            // Parse force option
            const force =
                args[1]?.toLowerCase() === "force" ||
                args[1]?.toLowerCase() === "true";

            await handleStopCommand(
                message,
                force,
                executorName,
                startTime,
                isPrefix,
            );
        } else {
            // Handle slash command
            const slashInteraction = interaction as ChatInputCommandInteraction;
            const subcommand = slashInteraction.options.getSubcommand();

            if (subcommand !== "stop") {
                await slashInteraction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("❌ Invalid subcommand!")
                            .addFields({
                                name: "Available Subcommands",
                                value: "• `stop` - Safely stops the bot",
                            }),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const force = slashInteraction.options.getBoolean("force") ?? false;

            await handleStopCommand(
                slashInteraction,
                force,
                executorName,
                startTime,
                isPrefix,
            );
        }
    },
};

// Helper function to handle both slash and prefix stop commands
async function handleStopCommand(
    interaction: ChatInputCommandInteraction | Message,
    force: boolean,
    executorName: string,
    startTime: string,
    isPrefix: boolean,
) {
    // Create confirmation buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("stop_confirm")
            .setLabel("Yes, stop the bot")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🛑"),
        new ButtonBuilder()
            .setCustomId("stop_cancel")
            .setLabel("No, cancel")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("✖️"),
    );

    // Send confirmation message with platform-specific info
    const platformInfo = `Platform: ${process.platform}\nBase Path: ${getBasePath()}`;

    const confirmEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setTitle("⚠️ Confirm Bot Shutdown")
        .setDescription(
            "Are you sure you want to stop the bot? This will:\n\n" +
                "1️⃣ Disconnect the bot from Discord\n" +
                "2️⃣ Stop all processes\n" +
                "3️⃣ Remove bot-related files\n" +
                "4️⃣ Keep only: blacklist.env, .env, and start.sh\n\n" +
                `Shutdown Type: ${force ? "⚠️ Forced" : "🛑 Graceful"}\n\n` +
                `System Info:\n${platformInfo}`,
        )
        .setFooter({
            text: `Requested by ${executorName} • ${startTime} UTC`,
        });

    // Send confirmation message
    const response = isPrefix
        ? await (interaction as Message).reply({
              embeds: [confirmEmbed],
              components: [buttons],
          })
        : await (interaction as ChatInputCommandInteraction).reply({
              embeds: [confirmEmbed],
              components: [buttons],
          });

    const confirmMessage = await response.fetch();
    const userId = isPrefix
        ? (interaction as Message).author.id
        : (interaction as ChatInputCommandInteraction).user.id;

    try {
        // Wait for button interaction
        const confirmation = await confirmMessage.awaitMessageComponent({
            filter: (i) => i.user.id === userId,
            time: 30000,
            componentType: ComponentType.Button,
        });

        if (confirmation.customId === "stop_cancel") {
            const cancelEmbed = new EmbedBuilder()
                .setColor("#00ff00")
                .setDescription("✅ Bot shutdown cancelled.")
                .setFooter({
                    text: `Cancelled by ${executorName} • ${getCurrentUTCTime()} UTC`,
                });

            await confirmation.update({
                embeds: [cancelEmbed],
                components: [],
            });
            return;
        }

        await confirmation.update({ components: [] });

        if (force) {
            const forceStopEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("⚠️ Force stopping the bot...")
                .setFooter({
                    text: `Force stopped by ${executorName} • ${getCurrentUTCTime()} UTC`,
                });

            if (isPrefix) {
                await (interaction as Message).channel.send({
                    embeds: [forceStopEmbed],
                });
            } else {
                await confirmation.editReply({ embeds: [forceStopEmbed] });
            }

            Logger.warn("Force stopping the bot...");
            process.exit(1);
        } else {
            const shutdownEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setTitle("🛑 Bot Shutdown Initiated")
                .setDescription("Stopping the bot and cleaning up files...")
                .setFooter({
                    text: `Shutdown initiated by ${executorName} • ${getCurrentUTCTime()} UTC`,
                });

            if (isPrefix) {
                await (interaction as Message).channel.send({
                    embeds: [shutdownEmbed],
                });
            } else {
                await confirmation.editReply({ embeds: [shutdownEmbed] });
            }

            // Perform cleanup
            const preservedFiles = await cleanupFiles();

            // Send final message
            const finalEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setTitle("✅ Shutdown Complete")
                .setDescription(
                    "The following files have been preserved:\n" +
                        preservedFiles.map((file) => `• ${file}`).join("\n"),
                )
                .setFooter({
                    text: `Completed by ${executorName} • ${getCurrentUTCTime()} UTC`,
                });

            if (isPrefix) {
                await (interaction as Message).channel.send({
                    embeds: [finalEmbed],
                });
            } else {
                await (interaction as ChatInputCommandInteraction).followUp({
                    embeds: [finalEmbed],
                });
            }

            Logger.info(
                `Preserved files: ${preservedFiles.join(", ")}\nBot shutdown complete.`,
            );

            // Graceful shutdown
            const client = isPrefix
                ? (interaction as Message).client
                : (interaction as ChatInputCommandInteraction).client;
            await client.user?.setStatus("invisible");
            await client.destroy();
            process.exit(0);
        }
    } catch (error) {
        const currentTime = getCurrentUTCTime();

        if (error instanceof Error && error.message.includes("time")) {
            const timeoutEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Shutdown confirmation timed out.")
                .setFooter({
                    text: `Timeout • ${currentTime} UTC`,
                });

            if (isPrefix) {
                await (interaction as Message).channel.send({
                    embeds: [timeoutEmbed],
                    components: [],
                });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [timeoutEmbed],
                    components: [],
                });
            }
        } else {
            Logger.error("Error during shutdown:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ An error occurred during shutdown.")
                .setFooter({
                    text: `Error • ${currentTime} UTC`,
                });

            if (isPrefix) {
                await (interaction as Message).channel.send({
                    embeds: [errorEmbed],
                    components: [],
                });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [errorEmbed],
                    components: [],
                });
            }
        }
    }
}

// Helper function to get base path (used in the confirmation message)
function getBasePath(): string {
    if (process.env.CONTAINER_PATH) {
        return process.env.CONTAINER_PATH;
    }

    switch (process.platform) {
        case "win32":
            return (
                process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
            );
        case "darwin":
            return join(homedir(), "Library", "Application Support");
        default:
            return process.env.HOME || homedir();
    }
}
