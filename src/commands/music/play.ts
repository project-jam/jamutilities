import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember,
    TextChannel, // Added for type safety
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { DistubeHandler } from "../../handlers/distubeHandler";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Plays music in your voice channel")
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
            let textChannel: TextChannel; // To ensure DisTube gets a proper text channel

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
                textChannel = message.channel as TextChannel;

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

                const statusMessage = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `▶️ Attempting to play \`${query}\`. Please wait...`,
                            ),
                    ],
                });

                try {
                    await distube.play(member.voice.channel, query, {
                        member: member,
                        textChannel: textChannel,
                    });
                    // On success, DistubeHandler's event messages will provide further details.
                    // The statusMessage "Attempting to play..." can remain.
                } catch (error: any) {
                    Logger.error("Error calling distube.play (prefix):", error);
                    await statusMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Error playing \`${query}\`: ${error.message || "Unknown error"}. Check permissions or query.`,
                                ),
                        ],
                    });
                }
            } else {
                // Handle slash command
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;

                if (!slashInteraction.guild) {
                    // deferReply might not have been called yet, so use reply or editReply based on state.
                    const replyMethod =
                        slashInteraction.deferred || slashInteraction.replied
                            ? slashInteraction.editReply
                            : slashInteraction.reply;
                    await replyMethod.call(slashInteraction, {
                        content: "This command can only be used in a server!",
                        ephemeral: true, // Good for errors before deferral
                    });
                    return;
                }
                if (!slashInteraction.channel) {
                    const replyMethod =
                        slashInteraction.deferred || slashInteraction.replied
                            ? slashInteraction.editReply
                            : slashInteraction.reply;
                    await replyMethod.call(slashInteraction, {
                        content:
                            "Could not determine the channel for this command.",
                        ephemeral: true,
                    });
                    return;
                }
                textChannel = slashInteraction.channel as TextChannel;

                // Defer reply as early as possible.
                await slashInteraction.deferReply();

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

                // Update the deferred reply to "Attempting to play..."
                // This message will persist if distube.play() is successful,
                // as DisTube will send new messages for song details.
                await slashInteraction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription(
                                `▶️ Attempting to play \`${query}\`. Please wait...`,
                            ),
                    ],
                });

                try {
                    await distube.play(member.voice.channel, query, {
                        member: member,
                        textChannel: textChannel,
                    });
                    // If distube.play was successful, the "Attempting to play..." message
                    // from editReply above is a good final state for this interaction's direct reply.
                    // DisTube's own handlers will send new messages with song details.
                } catch (error: any) {
                    Logger.error("Error calling distube.play (slash):", error);
                    // Ensure we edit the reply, as it's already deferred.
                    if (
                        !slashInteraction.replied &&
                        !slashInteraction.deferred
                    ) {
                        // This case should ideally not happen if deferReply was successful
                        await slashInteraction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ Error playing \`${query}\`: ${error.message || "Unknown error"}. Check permissions or query.`,
                                    ),
                            ],
                            ephemeral: true,
                        });
                    } else {
                        await slashInteraction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ Error playing \`${query}\`: ${error.message || "Unknown error"}. Check permissions or query.`,
                                    ),
                            ],
                        });
                    }
                }
            }
        } catch (error: any) {
            Logger.error("General error in play command:", error);

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
