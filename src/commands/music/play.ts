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
        .setName("play")
        .setDescription("Plays music in your voice channel")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("query")
                .setDescription("The song title or URL to play")
                .setRequired(true),
        ),

    prefix: {
        aliases: ["play", "p"],
        usage: "<song name or URL>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let query: string;
            let member: GuildMember;
            let distube = DistubeHandler.getInstance(
                interaction.client,
            ).distube;

            if (isPrefix) {
                const message = interaction as Message;

                // Handle prefix command
                if (!message.guild) {
                    await message.reply(
                        "This command can only be used in a server!",
                    );
                    return;
                }

                const args = message.content.trim().split(/ +/).slice(1);
                if (!args.length) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Please provide a song name or URL!",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: `${process.env.PREFIX || "jam!"}play <song name or URL>`,
                                }),
                        ],
                    });
                    return;
                }

                query = args.join(" ").trim();
                member = message.member!;

                if (!member.voice.channel) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to play music!",
                                ),
                        ],
                    });
                    return;
                }

                const searchMessage = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(`🔍 Searching for \`${query}\`...`),
                    ],
                });

                try {
                    await distube.play(member.voice.channel, query, {
                        member: member,
                        textChannel: message.channel,
                    });

                    // Update the search message after playing starts
                    await searchMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `🔍 Found and starting playback...`,
                                ),
                        ],
                    });
                } catch (error) {
                    Logger.error("Error playing song:", error);
                    await searchMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error playing the song: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
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

                member = slashInteraction.member as GuildMember;

                if (!member.voice.channel) {
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You need to be in a voice channel to play music!",
                                ),
                        ],
                    });
                    return;
                }

                query = slashInteraction.options
                    .getString("query", true)
                    .trim();

                await slashInteraction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(`🔍 Searching for \`${query}\`...`),
                    ],
                });

                try {
                    await distube.play(member.voice.channel, query, {
                        member: member,
                        textChannel: slashInteraction.channel,
                    });

                    // Update after playing starts
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `🔍 Found and starting playback...`,
                                ),
                        ],
                    });
                } catch (error) {
                    Logger.error("Error playing song:", error);
                    await slashInteraction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error playing the song: ${error.message || "Unknown error"}`,
                                ),
                        ],
                    });
                }
            }
        } catch (error) {
            Logger.error("Error in play command:", error);

            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An unexpected error occurred while trying to play music.",
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
