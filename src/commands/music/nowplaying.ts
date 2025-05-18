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
        .setName("nowplaying")
        .setDescription("Shows detailed information about the current song")
        .setDMPermission(false),

    prefix: {
        aliases: ["nowplaying", "np", "current"],
        usage: "",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let member: GuildMember;
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
            }

            const queue = distube.getQueue(member.guild);
            if (!queue || !queue.songs.length) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ There's nothing playing right now!",
                            ),
                    ],
                });
                return;
            }

            const song = queue.songs[0];
            const currentTime = queue.currentTime;
            const duration = song.duration;
            const timeRemaining = duration - currentTime;
            const progressBar = createProgressBar(currentTime, duration);

            // Create detailed embed
            const embed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setAuthor({
                    name: "Now Playing",
                    iconURL: member.user.displayAvatarURL({ size: 64 }),
                })
                .setTitle(song.name)
                .setURL(song.url)
                .setDescription(
                    `${progressBar}\n\`${formatTime(currentTime)} / ${song.formattedDuration}\``,
                )
                .addFields(
                    {
                        name: "Requested By",
                        value:
                            song.user?.tag ||
                            song.member?.user.tag ||
                            "Unknown",
                        inline: true,
                    },
                    {
                        name: "Volume",
                        value: `${queue.volume}%`,
                        inline: true,
                    },
                    {
                        name: "Loop Mode",
                        value: getRepeatModeName(queue.repeatMode),
                        inline: true,
                    },
                    {
                        name: "Time Remaining",
                        value: formatTime(timeRemaining),
                        inline: true,
                    },
                    {
                        name: "Position",
                        value: `Track ${queue.songs.indexOf(song) + 1}/${queue.songs.length}`,
                        inline: true,
                    },
                )
                .setImage(song.thumbnail || null)
                .setFooter({
                    text: queue.filters.names.length
                        ? `Active Filters: ${queue.filters.names.join(", ")}`
                        : "No active filters",
                })
                .setTimestamp();

            // Add next song info if available
            if (queue.songs.length > 1) {
                const nextSong = queue.songs[1];
                embed.addFields({
                    name: "Up Next",
                    value: `[${nextSong.name}](${nextSong.url}) • ${nextSong.formattedDuration}\nRequested by: ${nextSong.user?.tag || nextSong.member?.user.tag || "Unknown"}`,
                    inline: false,
                });
            }

            await replyFunction({ embeds: [embed] });
        } catch (error) {
            Logger.error("Error in nowplaying command:", error);
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

// Helper function for creating the progress bar
function createProgressBar(currentTime: number, totalDuration: number): string {
    if (!currentTime || !totalDuration) return "🔘 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";

    const progressBarLength = 18;
    const filledLength = Math.round(
        (currentTime / totalDuration) * progressBarLength,
    );

    const filled = "▬".repeat(filledLength);
    const empty = "▬".repeat(progressBarLength - filledLength);

    return `${filled}🔘${empty}`;
}

// Helper function to format time
function formatTime(seconds: number): string {
    if (!seconds) return "0:00";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Helper function to get repeat mode name
function getRepeatModeName(mode: number): string {
    switch (mode) {
        case 0:
            return "Off";
        case 1:
            return "Song";
        case 2:
            return "Queue";
        default:
            return "Unknown";
    }
}
