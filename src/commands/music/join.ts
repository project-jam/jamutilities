import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    VoiceChannel,
    GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { DistubeHandler } from "../../handlers/distubeHandler";

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

            // Check if user is in a voice channel
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

            // Check if it's a valid voice channel type
            if (member.voice.channel.type !== 2) {
                // 2 is GUILD_VOICE
                await replyFunction({
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

            // Check if bot is already in the same voice channel
            const voiceConnection = distube.voices.get(member.guild);
            if (
                voiceConnection &&
                voiceConnection.channel.id === member.voice.channel.id
            ) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ffae42")
                            .setDescription(
                                "ℹ️ I'm already in your voice channel!",
                            ),
                    ],
                });
                return;
            }

            try {
                await distube.voices.join(member.voice.channel);
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🔊 Joined ${member.voice.channel.name}`,
                            ),
                    ],
                });
            } catch (error) {
                Logger.error("Error joining voice channel:", error);
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `❌ Error joining channel: ${error.message || "Unknown error"}`,
                            ),
                    ],
                });
            }
        } catch (error) {
            Logger.error("Error in join command:", error);
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
