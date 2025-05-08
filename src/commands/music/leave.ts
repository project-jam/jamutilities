import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { MusicHandler } from "../../handlers/musicHandler";

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
            // Get the guild ID
            const guildId = isPrefix
                ? (interaction as Message).guild?.id
                : (interaction as ChatInputCommandInteraction).guild?.id;

            if (!guildId) {
                const notInGuildMessage =
                    "This command can only be used in a server!";

                if (isPrefix) {
                    await (interaction as Message).reply(notInGuildMessage);
                } else {
                    await (interaction as ChatInputCommandInteraction).reply({
                        content: notInGuildMessage,
                        ephemeral: true,
                    });
                }
                return;
            }

            if (isPrefix) {
                const message = interaction as Message;

                // Check if user is in a voice channel
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

                // Initialize music handler
                const musicHandler = new MusicHandler(message.client);
                await musicHandler.leaveVoiceChannel(guildId, message);
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                await slashInteraction.deferReply();

                // Check if user is in a voice channel
                const member = await slashInteraction.guild!.members.fetch(
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

                // Initialize music handler
                const musicHandler = new MusicHandler(slashInteraction.client);
                await musicHandler.leaveVoiceChannel(guildId, slashInteraction);
            }
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
                if ((interaction as ChatInputCommandInteraction).deferred) {
                    await (
                        interaction as ChatInputCommandInteraction
                    ).editReply({
                        embeds: [errorEmbed],
                    });
                } else {
                    await (interaction as ChatInputCommandInteraction).reply({
                        embeds: [errorEmbed],
                        ephemeral: true,
                    });
                }
            }
        }
    },
};
