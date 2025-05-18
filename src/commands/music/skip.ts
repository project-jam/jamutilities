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
        .setName("skip")
        .setDescription(
            "Skips the current song or skips to a specific position in queue",
        )
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option
                .setName("position")
                .setDescription("Queue position to skip to (optional)")
                .setRequired(false)
                .setMinValue(1),
        ),

    prefix: {
        aliases: ["skip", "s", "next"],
        usage: "[position]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let member: GuildMember;
            let position: number | null = null;
            let replyFunction: (options: any) => Promise<any>;
            let deferReplyFunction: (() => Promise<any>) | null = null;

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
                if (args.length > 0) {
                    const parsed = parseInt(args[0]);
                    if (!isNaN(parsed) && parsed > 0) {
                        position = parsed;
                    }
                }
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
                position = slashInteraction.options.getInteger("position");
            }

            if (!member.voice.channel) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ You need to be in a voice channel to skip music!",
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
                            .setDescription("❌ There's no music playing!"),
                    ],
                });
                return;
            }

            // If a position is specified, validate it
            if (position !== null) {
                if (position >= queue.songs.length) {
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Invalid position! The queue only has ${queue.songs.length - 1} songs.`,
                                ),
                        ],
                    });
                    return;
                }

                try {
                    const targetSong = queue.songs[position];
                    // Skip to the specified position
                    await queue.jump(position);
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `⏭️ Skipped to: [${targetSong.name}](${targetSong.url})`,
                                )
                                .setThumbnail(targetSong.thumbnail || null),
                        ],
                    });
                } catch (error) {
                    Logger.error(
                        `Error jumping to position ${position}:`,
                        error,
                    );
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error skipping to position ${position}: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            } else {
                // Regular skip
                if (queue.songs.length <= 1) {
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ There are no more songs in the queue!",
                                ),
                        ],
                    });
                    return;
                }

                try {
                    const skippedSong = queue.songs[0];
                    const nextSong = queue.songs[1];
                    await queue.skip();
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setTitle("⏭️ Skipped Current Song")
                                .setDescription(
                                    `Skipped: [${skippedSong.name}](${skippedSong.url})\nNow Playing: [${nextSong.name}](${nextSong.url})`,
                                )
                                .setThumbnail(nextSong.thumbnail || null),
                        ],
                    });
                } catch (error) {
                    Logger.error("Error skipping song:", error);
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error skipping song: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            }
        } catch (error) {
            Logger.error("Error in skip command:", error);
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
