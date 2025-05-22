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
        .addIntegerOption((option) =>
            option
                .setName("page")
                .setDescription("The page number to view")
                .setRequired(false)
                .setMinValue(1),
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
            const distube = DistubeHandler.getInstance(
                interaction.client,
            ).distube;
            let guild;

            if (isPrefix) {
                const message = interaction as Message;
                if (!message.guild) {
                    await message.reply(
                        "This command can only be used in a server!",
                    );
                    return;
                }
                guild = message.guild;

                const args = message.content.trim().split(/ +/).slice(1);
                if (args.length > 0) {
                    const parsed = parseInt(args[0]);
                    if (!isNaN(parsed) && parsed > 0) pageNum = parsed;
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
                guild = slashInteraction.guild;
                pageNum = slashInteraction.options.getInteger("page") || 1;
            }

            const queue = distube.getQueue(guild);
            if (!queue || !queue.songs.length) {
                const reply = {
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ There's no music in the queue!",
                            ),
                    ],
                };
                if (isPrefix) await (interaction as Message).reply(reply);
                else
                    await (
                        interaction as ChatInputCommandInteraction
                    ).editReply(reply);
                return;
            }

            const itemsPerPage = 10;
            const totalPages =
                Math.ceil((queue.songs.length - 1) / itemsPerPage) || 1;
            if (pageNum > totalPages) pageNum = totalPages;

            const startIdx = (pageNum - 1) * itemsPerPage + 1; // +1 because first song is current
            const endIdx = Math.min(
                startIdx + itemsPerPage,
                queue.songs.length,
            );

            // Build queue list
            let queueList = `**Now Playing:**\n[${queue.songs[0].name}](${queue.songs[0].url}) • ${queue.songs[0].formattedDuration}\nRequested by: ${queue.songs[0].user?.tag || queue.songs[0].member?.user.tag || "Unknown"}\n\n`;

            if (queue.songs.length > 1) {
                queueList += "**Up Next:**\n";
                for (let i = startIdx; i < endIdx; i++) {
                    const song = queue.songs[i];
                    queueList += `\`${i}.\` [${song.name}](${song.url}) • ${song.formattedDuration}\nRequested by: ${song.user?.tag || song.member?.user.tag || "Unknown"}\n\n`;
                }
            }

            const durationMs = queue.songs.reduce(
                (acc, song) => acc + song.duration * 1000,
                0,
            );
            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.floor((durationMs % 3600000) / 60000);

            const embed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle(`📑 Queue - ${queue.songs.length} tracks`)
                .setDescription(queueList)
                .setFooter({
                    text: `Page ${pageNum}/${totalPages} • Total duration: ${hours}h ${minutes}m`,
                })
                .setTimestamp();

            const reply = { embeds: [embed] };
            if (isPrefix) await (interaction as Message).reply(reply);
            else
                await (interaction as ChatInputCommandInteraction).editReply(
                    reply,
                );
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
