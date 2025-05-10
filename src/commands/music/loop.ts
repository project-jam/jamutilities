import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { DistubeHandler } from "../../handlers/distubeHandler";
import { RepeatMode } from "distube";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Toggle loop mode for the current song or queue")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("mode")
                .setDescription("The loop mode to set")
                .setRequired(true)
                .addChoices(
                    { name: "Off", value: "off" },
                    { name: "Song", value: "song" },
                    { name: "Queue", value: "queue" },
                ),
        ),

    prefix: {
        aliases: ["loop", "repeat"],
        usage: "<off|song|queue>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let mode: string;
            let member: GuildMember;

            const distube = DistubeHandler.getInstance(
                interaction.client,
            ).distube;

            if (isPrefix) {
                const message = interaction as Message;

                if (!message.guild) {
                    await message.reply(
                        "This command can only be used in a server!",
                    );
                    return;
                }
                if (!message.member) {
                    await message.reply(
                        "Could not identify you as a member of this server.",
                    );
                    return;
                }
                member = message.member;

                const args = message.content.trim().split(/ +/).slice(1);
                if (!args.length) {
                    // If no arguments provided, show current status and usage
                    const queue = distube.getQueue(message.guild);
                    if (!queue) {
                        await message.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ There is nothing playing right now!",
                                    ),
                            ],
                        });
                        return;
                    }

                    const currentMode = queue.repeatMode;
                    let modeString: string;

                    switch (currentMode) {
                        case RepeatMode.DISABLED:
                            modeString = "Disabled";
                            break;
                        case RepeatMode.SONG:
                            modeString = "Current Song";
                            break;
                        case RepeatMode.QUEUE:
                            modeString = "Queue";
                            break;
                        default:
                            modeString = "Unknown";
                    }

                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#4f74c8")
                                .setTitle("🔄 Loop Status")
                                .setDescription(
                                    `Current loop mode: **${modeString}**`,
                                )
                                .addFields({
                                    name: "Usage",
                                    value: `${process.env.PREFIX || "jam!"}loop <off|song|queue>`,
                                }),
                        ],
                    });
                    return;
                }

                mode = args[0].toLowerCase();
                if (!["off", "song", "queue"].includes(mode)) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Invalid loop mode! Please use `off`, `song`, or `queue`",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: `${process.env.PREFIX || "jam!"}loop <off|song|queue>`,
                                }),
                        ],
                    });
                    return;
                }

                if (!member.voice.channel) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to use this command!",
                                ),
                        ],
                    });
                    return;
                }

                const queue = distube.getQueue(message.guild);
                if (!queue) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ There is nothing playing right now!",
                                ),
                        ],
                    });
                    return;
                }

                try {
                    let newMode: RepeatMode;
                    let modeEmoji: string;
                    let modeName: string;

                    switch (mode) {
                        case "off":
                            newMode = RepeatMode.DISABLED;
                            modeEmoji = "▶️";
                            modeName = "Disabled";
                            break;
                        case "song":
                            newMode = RepeatMode.SONG;
                            modeEmoji = "🔂";
                            modeName = "Current Song";
                            break;
                        case "queue":
                            newMode = RepeatMode.QUEUE;
                            modeEmoji = "🔁";
                            modeName = "Queue";
                            break;
                        default:
                            newMode = RepeatMode.DISABLED;
                            modeEmoji = "▶️";
                            modeName = "Disabled";
                    }

                    queue.setRepeatMode(newMode);

                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#4f74c8")
                                .setDescription(
                                    `${modeEmoji} Loop mode set to: **${modeName}**`,
                                ),
                        ],
                    });
                } catch (error: any) {
                    Logger.error("Error setting repeat mode (prefix):", error);
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error setting loop mode: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            } else {
                // Handle slash command
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;

                if (!slashInteraction.guild) {
                    await slashInteraction.reply({
                        content: "This command can only be used in a server!",
                        ephemeral: true,
                    });
                    return;
                }

                member = slashInteraction.member as GuildMember;

                if (!member.voice.channel) {
                    await slashInteraction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to use this command!",
                                ),
                        ],
                        ephemeral: true,
                    });
                    return;
                }

                const queue = distube.getQueue(slashInteraction.guild);
                if (!queue) {
                    await slashInteraction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ There is nothing playing right now!",
                                ),
                        ],
                        ephemeral: true,
                    });
                    return;
                }

                mode = slashInteraction.options.getString("mode", true);

                try {
                    let newMode: RepeatMode;
                    let modeEmoji: string;
                    let modeName: string;

                    switch (mode) {
                        case "off":
                            newMode = RepeatMode.DISABLED;
                            modeEmoji = "▶️";
                            modeName = "Disabled";
                            break;
                        case "song":
                            newMode = RepeatMode.SONG;
                            modeEmoji = "🔂";
                            modeName = "Current Song";
                            break;
                        case "queue":
                            newMode = RepeatMode.QUEUE;
                            modeEmoji = "🔁";
                            modeName = "Queue";
                            break;
                        default:
                            newMode = RepeatMode.DISABLED;
                            modeEmoji = "▶️";
                            modeName = "Disabled";
                    }

                    queue.setRepeatMode(newMode);

                    await slashInteraction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#4f74c8")
                                .setDescription(
                                    `${modeEmoji} Loop mode set to: **${modeName}**`,
                                ),
                        ],
                    });
                } catch (error: any) {
                    Logger.error("Error setting repeat mode (slash):", error);
                    await slashInteraction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error setting loop mode: ${error.message || "Unknown error"}`,
                                ),
                        ],
                        ephemeral: true,
                    });
                }
            }
        } catch (error: any) {
            Logger.error("General error in loop command:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An unexpected error occurred. Please try again.",
                );

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                if (slashInteraction.replied || slashInteraction.deferred) {
                    await slashInteraction.editReply({ embeds: [errorEmbed] });
                } else {
                    await slashInteraction.reply({
                        embeds: [errorEmbed],
                        ephemeral: true,
                    });
                }
            }
        }
    },
};
