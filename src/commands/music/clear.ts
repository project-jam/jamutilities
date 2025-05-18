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
        .setName("clear")
        .setDescription("Clears the music queue but keeps the current song")
        .setDMPermission(false),

    prefix: {
        aliases: ["clear", "clearqueue", "cq"],
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

            if (queue.songs.length <= 1) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ffae42")
                            .setDescription("ℹ️ The queue is already empty!"),
                    ],
                });
                return;
            }

            try {
                // Keep the first song (currently playing) and remove the rest
                const removedCount = queue.songs.length - 1;
                queue.songs = [queue.songs[0]];

                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🧹 Cleared ${removedCount} song${removedCount !== 1 ? "s" : ""} from the queue!`,
                            ),
                    ],
                });
            } catch (error) {
                Logger.error("Error clearing queue:", error);
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `❌ Error clearing queue: ${error.message || "Unknown error"}`,
                            ),
                    ],
                });
            }
        } catch (error) {
            Logger.error("Error in clear command:", error);
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
