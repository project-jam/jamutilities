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
        .setName("remove")
        .setDescription("Removes a specific song from the queue")
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option
                .setName("position")
                .setDescription(
                    "The position of the song to remove (use /queue to see positions)",
                )
                .setRequired(true)
                .setMinValue(1),
        ),

    prefix: {
        aliases: ["remove", "rm"],
        usage: "<position>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let member: GuildMember;
            let position: number;
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
                                    "❌ Please specify a song position to remove!",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: `${process.env.PREFIX || "jam!"}remove <position>`,
                                }),
                        ],
                    });
                    return;
                }

                position = parseInt(args[0]);
                if (isNaN(position) || position < 1) {
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Please provide a valid position number!",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: "Use /queue to see song positions",
                                }),
                        ],
                    });
                    return;
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
                position = slashInteraction.options.getInteger(
                    "position",
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
                            .setDescription("❌ There's no active queue!"),
                    ],
                });
                return;
            }

            // Position 0 is currently playing, so we need to add 1 to get the queue position
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
                const removedSong = queue.songs[position];
                queue.songs.splice(position, 1);

                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🗑️ Removed: [${removedSong.name}](${removedSong.url})`,
                            )
                            .setThumbnail(removedSong.thumbnail || null),
                    ],
                });
            } catch (error) {
                Logger.error("Error removing song:", error);
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `❌ Error removing song: ${error.message || "Unknown error"}`,
                            ),
                    ],
                });
            }
        } catch (error) {
            Logger.error("Error in remove command:", error);
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
