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
        .setDescription("Skips the current song")
        .setDMPermission(false),

    prefix: {
        aliases: ["skip", "s", "next"],
        usage: "",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let member: GuildMember;
            let distube = DistubeHandler.getInstance(
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

                member = message.member!;

                if (!member.voice.channel) {
                    await message.reply({
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

                const queue = distube.getQueue(message.guild);

                if (!queue) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription("❌ There's no music playing!"),
                        ],
                    });
                    return;
                }

                if (queue.songs.length <= 1) {
                    await message.reply({
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
                    await queue.skip();

                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `⏭️ Skipped: [${skippedSong.name}](${skippedSong.url})`,
                                ),
                        ],
                    });
                } catch (error) {
                    Logger.error("Error skipping song:", error);
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error skipping song: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                await slashInteraction.deferReply();

                if (!slashInteraction.guild) {
                    await slashInteraction.editReply(
                        "This command can only be used in a server!",
                    );
                    return;
                }

                member = slashInteraction.member as GuildMember;

                if (!member.voice.channel) {
                    await slashInteraction.editReply({
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

                const queue = distube.getQueue(slashInteraction.guild);

                if (!queue) {
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription("❌ There's no music playing!"),
                        ],
                    });
                    return;
                }

                if (queue.songs.length <= 1) {
                    await slashInteraction.editReply({
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
                    await queue.skip();

                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `⏭️ Skipped: [${skippedSong.name}](${skippedSong.url})`,
                                ),
                        ],
                    });
                } catch (error) {
                    Logger.error("Error skipping song:", error);
                    await slashInteraction.editReply({
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
                .setDescription(
                    "❌ An error occurred while trying to skip the song.",
                );

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [errorEmbed],
                });
            }
        }
    },
};
