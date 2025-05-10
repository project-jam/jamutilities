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
        .setName("leave")
        .setDescription("Makes the bot leave the voice channel")
        .setDMPermission(false),

    prefix: {
        aliases: ["leave", "disconnect", "dc"],
        usage: "",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let guild;
            let member: GuildMember | null | undefined;
            let replyFunction: (options: any) => Promise<any>;
            let deferReplyFunction: (() => Promise<any>) | null = null;

            if (isPrefix) {
                const message = interaction as Message;
                if (!message.guild || !message.member) {
                    await message.reply(
                        "This command can only be used in a server by a member!",
                    );
                    return;
                }
                guild = message.guild;
                member = message.member;
                replyFunction = message.reply.bind(message);
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                if (!slashInteraction.guild || !slashInteraction.member) {
                    await slashInteraction.reply({
                        content:
                            "This command can only be used in a server by a member!",
                        ephemeral: true,
                    });
                    return;
                }
                guild = slashInteraction.guild;
                member = slashInteraction.member as GuildMember;
                replyFunction =
                    slashInteraction.editReply.bind(slashInteraction);
                deferReplyFunction =
                    slashInteraction.deferReply.bind(slashInteraction);
                await deferReplyFunction();
            }

            const userVoiceChannel = member?.voice.channel;
            if (!userVoiceChannel) {
                await replyFunction({
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

            const distube = DistubeHandler.getInstance(
                (interaction as any).client,
            ).distube;
            const botVoiceConnection = distube.voices.get(guild.id);

            if (!botVoiceConnection) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ I'm not currently in a voice channel.",
                            ),
                    ],
                });
                return;
            }

            if (userVoiceChannel.id !== botVoiceConnection.channel.id) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ You must be in the same voice channel as me to use this command.",
                            ),
                    ],
                });
                return;
            }

            const queue = distube.getQueue(guild.id);
            const otherHumanListeners =
                botVoiceConnection.channel.members.filter(
                    (m) => !m.user.bot && m.id !== member!.id,
                ).size;

            // If others are listening, only the original requester can stop
            if (otherHumanListeners > 0) {
                if (
                    !queue ||
                    !queue.songs.length ||
                    queue.songs[0].user.id !== member!.id
                ) {
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ffae42")
                                .setDescription(
                                    "🎶 Others are still listening! Only the user who requested the current song can make me stop the music right now.",
                                ),
                        ],
                    });
                    return;
                }
            }

            // Proceed to leave or stop when allowed
            if (queue && (queue.playing || queue.songs.length > 0)) {
                await queue.stop();
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                "👋 Stopping music and leaving the voice channel.",
                            ),
                    ],
                });
            } else {
                await distube.voices.leave(guild.id);
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription("👋 Leaving the voice channel."),
                    ],
                });
            }

            Logger.info(
                `Left voice channel in guild: ${guild.name} (ID: ${guild.id}) by request of ${member.user.tag}`,
            );
        } catch (error) {
            Logger.error("Error in leave command:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An error occurred while trying to leave the voice channel.",
                );

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                const slash = interaction as ChatInputCommandInteraction;
                if (slash.deferred || slash.replied) {
                    await slash.editReply({ embeds: [errorEmbed] });
                } else {
                    await slash.reply({
                        embeds: [errorEmbed],
                        ephemeral: true,
                    });
                }
            }
        }
    },
};
