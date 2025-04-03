////////////////////////////////////////////////////////////////////
///// WARNING: This file is not being used in the project.     /////
///// If you want to use it, you need to import it in index.ts /////
///// Even tho it's a command, don't run it.                   /////
///// As this file is not being used, it is not being tested.  /////
///// It may or may not work as expected.                      /////
///// And it may crash the bot.                                /////
///// You have been warned.                                    /////
////////////////////////////////////////////////////////////////////

import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { DistubeHandler } from "../../handlers/distubeHandler";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Shows the current music queue")
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option
                .setName("page")
                .setDescription("The page number to view")
                .setRequired(false),
        ),

    prefix: {
        aliases: ["queue", "q"],
        usage: "[page]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let pageNum = 1;
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

                const args = message.content.trim().split(/ +/).slice(1);
                if (args.length > 0) {
                    const parsed = parseInt(args[0]);
                    if (!isNaN(parsed) && parsed > 0) {
                        pageNum = parsed;
                    }
                }

                const queue = distube.getQueue(message.guild);

                if (!queue || !queue.songs || queue.songs.length === 0) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ There's no music in the queue!",
                                ),
                        ],
                    });
                    return;
                }

                const totalPages = Math.ceil(queue.songs.length / 10) || 1;
                if (pageNum > totalPages) pageNum = totalPages;

                const queueEmbed = createQueueEmbed(queue, pageNum, totalPages);
                await message.reply({ embeds: [queueEmbed] });
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

                pageNum = slashInteraction.options.getInteger("page") || 1;
                if (pageNum < 1) pageNum = 1;

                const queue = distube.getQueue(slashInteraction.guild);

                if (!queue || !queue.songs || queue.songs.length === 0) {
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ There's no music in the queue!",
                                ),
                        ],
                    });
                    return;
                }

                const totalPages = Math.ceil(queue.songs.length / 10) || 1;
                if (pageNum > totalPages) pageNum = totalPages;

                const queueEmbed = createQueueEmbed(queue, pageNum, totalPages);
                await slashInteraction.editReply({ embeds: [queueEmbed] });
            }
        } catch (error) {
            Logger.error("Error in queue command:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An error occurred while trying to display the queue.",
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

function createQueueEmbed(
    queue: any,
    page: number,
    totalPages: number,
): EmbedBuilder {
    const songs = queue.songs;
    const currentSong = songs[0];
    const startIdx = (page - 1) * 10;
    const endIdx = Math.min(startIdx + 10, songs.length);

    let queueList = "";

    for (let i = startIdx; i < endIdx; i++) {
        const song = songs[i];
        if (i === 0) {
            queueList += `**Now Playing:**\n[${song.name}](${song.url}) (${song.formattedDuration})\nRequested by: ${song.user?.tag || "Unknown"}\n\n`;
        } else {
            queueList += `**${i}.** [${song.name}](${song.url}) (${song.formattedDuration})\nRequested by: ${song.user?.tag || "Unknown"}\n\n`;
        }
    }

    if (queueList.length === 0) {
        queueList = "No songs in the queue.";
    }

    const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle("🎵 Music Queue")
        .setDescription(queueList)
        .setThumbnail(currentSong.thumbnail || null)
        .setFooter({
            text: `Page ${page}/${totalPages} • Total songs: ${songs.length}`,
        })
        .addFields(
            {
                name: "Now Playing",
                value: `[${currentSong.name}](${currentSong.url})`,
                inline: true,
            },
            {
                name: "Duration",
                value: currentSong.formattedDuration,
                inline: true,
            },
            { name: "Volume", value: `${queue.volume}%`, inline: true },
        )
        .setTimestamp();

    return embed;
}
