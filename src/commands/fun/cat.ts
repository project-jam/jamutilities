import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { getEsmImageUrl } from "../../utils/esmApi";
import { Logger } from "../../utils/logger";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("cat")
        .setDMPermission(true)
        .setDescription("Shows a random cat picture."),

    prefix: {
        aliases: ["cat", "kitty"],
        usage: "",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        const imageType = "cat"; // Hardcoded for this command

        try {
            if (!isPrefix) {
                await (interaction as ChatInputCommandInteraction).deferReply();
            }

            const imageUrl = await getEsmImageUrl(imageType);

            const embed = new EmbedBuilder()
                .setTitle("🐱 Here's a cat picture!")
                .setImage(imageUrl)
                .setColor("#5865F2")
                .setTimestamp();

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [embed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [embed],
                });
            }
        } catch (error: any) {
            Logger.error(`Error executing cat command:`, error);

            let errorMessage =
                "Sorry, I couldn't fetch a cat picture right now! 😿";

            if (
                error.message?.includes(
                    "API path for type 'cat' is not configured",
                )
            ) {
                errorMessage =
                    "The cat image API is currently not configured correctly. Please contact the bot owner.";
            }

            if (isPrefix) {
                await (interaction as Message).reply(errorMessage);
            } else {
                const interactionObj =
                    interaction as ChatInputCommandInteraction;

                if (interactionObj.deferred || interactionObj.replied) {
                    await interactionObj
                        .editReply(errorMessage)
                        .catch((e) =>
                            Logger.error(
                                "Failed to editReply with error message:",
                                e,
                            ),
                        );
                } else {
                    await interactionObj
                        .reply(errorMessage)
                        .catch((e) =>
                            Logger.error(
                                "Failed to reply with error message:",
                                e,
                            ),
                        );
                }
            }
        }
    },
};
