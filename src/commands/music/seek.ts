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

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("seek")
        .setDescription("Seeks to a specific position in the current song")
        .addStringOption((option) =>
            option
                .setName("timestamp")
                .setDescription("Time to seek to (e.g., 1:30, 2m30s, 150)")
                .setRequired(true),
        ),

    prefix: {
        aliases: ["seek", "timestamp", "sk"],
        usage: "<timestamp>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let member: GuildMember;
            let timestamp: string;
            let replyFunction: (options: any) => Promise<any>;

            const distube = DistubeHandler.getInstance(
                interaction.client,
            ).distube;

            if (isPrefix) {
                const message = interaction as Message;
                if (!message.guild || !message.member) {
                    await message.reply(
                        "This command can only be used in a server!",
                    );
                    return;
                }
                member = message.member;
                replyFunction = message.reply.bind(message);

                const args = message.content.trim().split(/ +/).slice(1);
                if (!args.length) {
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Please provide a timestamp!",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: `${process.env.PREFIX || "jam!"}seek <timestamp>\nExamples: 1:30, 2m30s, 150`,
                                }),
                        ],
                    });
                    return;
                }
                timestamp = args[0];
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                await slashInteraction.deferReply();

                if (!slashInteraction.guild || !slashInteraction.member) {
                    await slashInteraction.editReply(
                        "This command can only be used in a server!",
                    );
                    return;
                }
                member = slashInteraction.member as GuildMember;
                replyFunction =
                    slashInteraction.editReply.bind(slashInteraction);
                timestamp = slashInteraction.options.getString(
                    "timestamp",
                    true,
                );
            }

            if (!member.voice.channel) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ You need to be in a voice channel!",
                            ),
                    ],
                });
                return;
            }

            const queue = distube.getQueue(member.guild);
            if (!queue) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("❌ There's nothing playing!"),
                    ],
                });
                return;
            }

            // Parse the timestamp into seconds
            const seconds = parseTimestamp(timestamp);
            if (seconds === null) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ Invalid timestamp format! Use format like: 1:30, 2m30s, or 150",
                            )
                            .addFields({
                                name: "Examples",
                                value: "• 1:30 (1 minute 30 seconds)\n• 2m30s (2 minutes 30 seconds)\n• 150 (150 seconds)",
                            }),
                    ],
                });
                return;
            }

            try {
                await queue.seek(seconds);
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `⏩ Seeked to ${formatTime(seconds)}`,
                            ),
                    ],
                });
            } catch (error) {
                Logger.error("Error seeking:", error);
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `❌ Error seeking: ${error.message || "Unknown error"}`,
                            ),
                    ],
                });
            }
        } catch (error) {
            Logger.error("Error in seek command:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ An unexpected error occurred.");

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

// Helper function to parse various timestamp formats into seconds
function parseTimestamp(timestamp: string): number | null {
    // Try mm:ss format
    const mmssMatch = timestamp.match(/^(\d+):(\d{1,2})$/);
    if (mmssMatch) {
        const minutes = parseInt(mmssMatch[1]);
        const seconds = parseInt(mmssMatch[2]);
        if (seconds < 60) {
            return minutes * 60 + seconds;
        }
        return null;
    }

    // Try XmYs format
    const minsSecsMatch = timestamp.match(/^(?:(\d+)m)?(?:(\d+)s)?$/);
    if (minsSecsMatch && (minsSecsMatch[1] || minsSecsMatch[2])) {
        const minutes = parseInt(minsSecsMatch[1] || "0");
        const seconds = parseInt(minsSecsMatch[2] || "0");
        return minutes * 60 + seconds;
    }

    // Try pure seconds format
    const secondsMatch = timestamp.match(/^\d+$/);
    if (secondsMatch) {
        return parseInt(timestamp);
    }

    return null;
}

// Helper function to format seconds into mm:ss
function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
