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
        .setName("resume")
        .setDescription("Resumes the currently paused music")
        .setDMPermission(false),
    prefix: {
        aliases: ["resume", "rs", "unpause"],
        usage: "",
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
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

                if (!member.voice.channel) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to resume music!",
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
                                    "❌ There is nothing in the queue to resume!",
                                ),
                        ],
                    });
                    return;
                }

                if (!queue.paused) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ The music is already playing!",
                                ),
                        ],
                    });
                    return;
                }

                try {
                    queue.resume();
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription("▶️ Resumed the music!"),
                        ],
                    });
                } catch (error: any) {
                    Logger.error("Error resuming music (prefix):", error);
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error resuming music: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            } else {
                // Handle slash command
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;

                if (!slashInteraction.guild) {
                    const replyMethod =
                        slashInteraction.deferred || slashInteraction.replied
                            ? slashInteraction.editReply
                            : slashInteraction.reply;
                    await replyMethod.call(slashInteraction, {
                        content: "This command can only be used in a server!",
                        ephemeral: true,
                    });
                    return;
                }

                // Defer reply as early as possible
                await slashInteraction.deferReply();

                member = slashInteraction.member as GuildMember;
                if (!member.voice.channel) {
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to resume music!",
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
                                .setDescription(
                                    "❌ There is nothing in the queue to resume!",
                                ),
                        ],
                    });
                    return;
                }

                if (!queue.paused) {
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ The music is already playing!",
                                ),
                        ],
                    });
                    return;
                }

                try {
                    queue.resume();
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription("▶️ Resumed the music!"),
                        ],
                    });
                } catch (error: any) {
                    Logger.error("Error resuming music (slash):", error);
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error resuming music: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            }
        } catch (error: any) {
            Logger.error("General error in resume command:", error);
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
                // Handle cases where interaction might already be replied to or deferred
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
