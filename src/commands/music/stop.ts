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
        .setName("stop")
        .setDescription("Stops playing music and clears the queue.")
        .setDMPermission(false),

    prefix: {
        aliases: ["stop", "end"],
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
                    await message.reply("This command can only be used in a server by a member!");
                    return;
                }
                guild = message.guild;
                member = message.member;
                replyFunction = message.reply.bind(message);
            } else {
                const slashInteraction = interaction as ChatInputCommandInteraction;
                if (!slashInteraction.guild || !slashInteraction.member) {
                    await slashInteraction.reply({ content: "This command can only be used in a server by a member!", ephemeral: true });
                    return;
                }
                guild = slashInteraction.guild;
                member = slashInteraction.member as GuildMember;
                replyFunction = slashInteraction.editReply.bind(slashInteraction);
                deferReplyFunction = slashInteraction.deferReply.bind(slashInteraction);
                await deferReplyFunction();
            }

            const userVoiceChannel = member?.voice.channel;
            if (!userVoiceChannel) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("❌ You need to be in a voice channel to use this command!"),
                    ],
                });
                return;
            }

            const distube = DistubeHandler.getInstance(interaction.client).distube;
            const botVoiceConnection = distube.voices.get(guild.id);

            if (!botVoiceConnection) {
                 await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("❌ I'm not currently in a voice channel."),
                    ],
                });
                return;
            }
            
            if (userVoiceChannel.id !== botVoiceConnection.channel.id) {
                 await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("❌ You must be in the same voice channel as me to use this command."),
                    ],
                });
                return;
            }

            const queue = distube.getQueue(guild.id);
            if (!queue || queue.songs.length === 0) { // No active queue or queue is empty
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("❌ There's no music currently playing!"),
                    ],
                });
                return;
            }

            const otherHumanListeners = botVoiceConnection.channel.members.filter(
                (m) => !m.user.bot && m.id !== member!.id,
            ).size;

            if (otherHumanListeners > 0) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ffae42") // Orange for warning
                            .setDescription("🎶 Others are still listening! I can't stop the music right now."),
                    ],
                });
                return;
            }

            await queue.stop();
            await replyFunction({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#2b2d31")
                        .setDescription("⏹️ Stopped the music and cleared the queue. The bot will leave the channel shortly if configured to do so."),
                ],
            });
            Logger.info(`Music stopped in guild: ${guild.name} (ID: ${guild.id}) by request of ${member.user.tag}`);

        } catch (error) {
            Logger.error("Error in stop command:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ An error occurred while trying to stop the music.");
            
            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                if ((interaction as ChatInputCommandInteraction).deferred || (interaction as ChatInputCommandInteraction).replied) {
                    await (interaction as ChatInputCommandInteraction).editReply({ embeds: [errorEmbed] });
                } else {
                    await (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed], ephemeral: true });
                }
            }
        }
    },
};