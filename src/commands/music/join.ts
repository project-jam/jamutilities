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
    VoiceChannel,
    MessageFlags,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { MusicHandler } from "../../handlers/musicHandler";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("join")
        .setDescription("Makes the bot join your voice channel")
        .setDMPermission(false),

    prefix: {
        aliases: ["join", "connect"],
        usage: "",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let voiceChannel: VoiceChannel | null = null;

            if (isPrefix) {
                const message = interaction as Message;

                // Handle prefix command
                if (!message.guild) {
                    await message.reply(
                        "This command can only be used in a server!",
                    );
                    return;
                }

                if (!message.member?.voice.channel) {
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

                if (message.member.voice.channel.type !== 2) {
                    // 2 is the value for GUILD_VOICE
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ I can only join regular voice channels!",
                                ),
                        ],
                    });
                    return;
                }

                voiceChannel = message.member.voice.channel as VoiceChannel;

                await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🔊 Attempting to join ${voiceChannel.name}...`,
                            ),
                    ],
                });

                // Initialize music handler
                const musicHandler = new MusicHandler(message.client);
                await musicHandler.joinVoiceChannel(message, voiceChannel);
            } else {
                // Handle slash command
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                await slashInteraction.deferReply();

                if (!slashInteraction.guild) {
                    await slashInteraction.editReply(
                        "This command can only be used in a server!",
                    );
                    return;
                }

                const member = await slashInteraction.guild.members.fetch(
                    slashInteraction.user.id,
                );

                if (!member.voice.channel) {
                    await slashInteraction.editReply({
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

                if (member.voice.channel.type !== 2) {
                    // 2 is the value for GUILD_VOICE
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ I can only join regular voice channels!",
                                ),
                        ],
                    });
                    return;
                }

                voiceChannel = member.voice.channel as VoiceChannel;

                await slashInteraction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🔊 Attempting to join ${voiceChannel.name}...`,
                            ),
                    ],
                });

                // Initialize music handler
                const musicHandler = new MusicHandler(slashInteraction.client);
                await musicHandler.joinVoiceChannel(
                    slashInteraction,
                    voiceChannel,
                );
            }
        } catch (error) {
            Logger.error("Error in join command:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An error occurred while trying to join the voice channel.",
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
