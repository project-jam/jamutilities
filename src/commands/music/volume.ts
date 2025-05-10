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
        .setName("volume")
        .setDescription("Sets or shows the music volume.")
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option
                .setName("level")
                .setDescription("The volume level (0-200). Leave empty to see current volume.")
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(200),
        ),

    prefix: {
        aliases: ["volume", "vol"],
        usage: "[level (0-200)]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let member: GuildMember;
            let replyFunction: (options: any) => Promise<any>;
            let deferReplyFunction: (() => Promise<any>) | null = null;
            let volumeLevel: number | null | undefined;

            const distube = DistubeHandler.getInstance(
                interaction.client,
            ).distube;

            if (isPrefix) {
                const message = interaction as Message;
                if (!message.guild || !message.member) {
                    await message.reply(
                        "This command can only be used in a server by a member!",
                    );
                    return;
                }
                member = message.member;
                replyFunction = message.reply.bind(message);

                const args = message.content.trim().split(/ +/).slice(1);
                if (args.length > 0) {
                    const parsedLevel = parseInt(args[0]);
                    if (isNaN(parsedLevel) || parsedLevel < 0 || parsedLevel > 200) {
                        await replyFunction({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ Invalid volume level! Please provide a number between 0 and 200.",
                                    )
                                    .addFields({ name: "Usage", value: `${process.env.PREFIX || "jam!"}volume [0-200]` }),
                            ],
                        });
                        return;
                    }
                    volumeLevel = parsedLevel;
                }
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
                member = slashInteraction.member as GuildMember;
                volumeLevel = slashInteraction.options.getInteger("level");
                
                // Defer reply if a volume level is being set, otherwise reply directly for current volume
                if (volumeLevel !== null) {
                    deferReplyFunction = slashInteraction.deferReply.bind(slashInteraction);
                    await deferReplyFunction();
                    replyFunction = slashInteraction.editReply.bind(slashInteraction);
                } else {
                    replyFunction = slashInteraction.reply.bind(slashInteraction);
                }
            }

            if (!member.voice.channel) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ You need to be in a voice channel to use this command!",
                            ),
                    ],
                    ephemeral: volumeLevel === null && !isPrefix // ephemeral if just checking volume with slash
                });
                return;
            }

            const queue = distube.getQueue(member.guild!);
            if (!queue) {
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ There is no music playing right now!",
                            ),
                    ],
                     ephemeral: volumeLevel === null && !isPrefix
                });
                return;
            }

            if (volumeLevel === null || volumeLevel === undefined) {
                // Show current volume
                await replyFunction({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `🔊 Current volume is: **${queue.volume}%**`,
                            ),
                    ],
                     ephemeral: !isPrefix // ephemeral if slash cmd checking volume
                });
            } else {
                // Set new volume
                try {
                    queue.setVolume(volumeLevel);
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `🔊 Volume set to **${volumeLevel}%**`,
                                ),
                        ],
                    });
                } catch (error: any) {
                    Logger.error("Error setting volume:", error);
                    await replyFunction({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error setting volume: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            }
        } catch (error: any) {
            Logger.error("General error in volume command:", error);
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