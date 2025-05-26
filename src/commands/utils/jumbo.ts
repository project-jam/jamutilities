import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

// Regex to find custom Discord emojis: <:name:id> or <a:name:id>
const customEmojiRegex = /<a?:(\w+):(\d+)>/g;

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("jumbo")
        .setDescription("Makes custom Discord emojis bigger")
        .addStringOption((option) =>
            option
                .setName("emojis")
                .setDescription("The custom Discord emoji(s) to make bigger")
                .setRequired(true),
        )
        .setDMPermission(true),

    prefix: {
        aliases: ["jumbo", "bigemoji"],
        usage: "<custom emoji(s)>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let emojiString: string;

        // Get the emoji string from the interaction
        if (isPrefix) {
            const args = (interaction as Message).content.split(/\s+/).slice(1);
            if (args.length === 0) {
                const replyMessage =
                    "Please provide at least one custom Discord emoji.";
                if (isPrefix) {
                    await (interaction as Message).reply(replyMessage);
                } else {
                    // This part shouldn't be reached with required slash command option, but as fallback
                    await (interaction as ChatInputCommandInteraction).reply({
                        content: replyMessage,
                        ephemeral: true,
                    });
                }
                return;
            }
            emojiString = args.join(" "); // Join arguments in case emojis were space-separated
        } else {
            emojiString = (
                interaction as ChatInputCommandInteraction
            ).options.getString("emojis", true);
        }

        const emojiUrls: string[] = [];
        let match;

        // Find all custom emojis in the string using the regex
        while ((match = customEmojiRegex.exec(emojiString)) !== null) {
            const emojiId = match[2];
            const isAnimated = match[0].startsWith("<a:"); // Check if the matched string starts with <a:
            const fileExtension = isAnimated ? "gif" : "png";
            const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${fileExtension}`;
            emojiUrls.push(emojiUrl);
        }

        if (emojiUrls.length === 0) {
            // No custom emojis found
            const replyMessage =
                "I couldn't find any valid custom Discord emojis in your input. Please provide a custom emoji like <:emoji_name:emoji_id> or <a:animated_emoji:emoji_id>.";
            if (isPrefix) {
                await (interaction as Message).reply(replyMessage);
            } else {
                await (interaction as ChatInputCommandInteraction).reply({
                    content: replyMessage,
                    ephemeral: true,
                });
            }
            return;
        }

        // Join URLs with newlines so Discord embeds each one as a large emoji
        const responseContent = emojiUrls.join("\n");

        // Reply or edit the deferred reply with the emoji URLs
        try {
            if (isPrefix) {
                await (interaction as Message).reply(responseContent);
            } else {
                // If deferred, edit the reply
                if (
                    (interaction as ChatInputCommandInteraction).deferred ||
                    (interaction as ChatInputCommandInteraction).replied
                ) {
                    await (
                        interaction as ChatInputCommandInteraction
                    ).editReply(responseContent);
                } else {
                    // If not deferred or replied (shouldn't happen with required option + defer), just reply
                    await (interaction as ChatInputCommandInteraction).reply(
                        responseContent,
                    );
                }
            }
        } catch (error) {
            console.error("Error sending jumbo emoji:", error);
            const errorMessage = "Failed to send the jumbo emoji(s).";
            if (isPrefix) {
                await (interaction as Message).reply(errorMessage);
            } else {
                // Try to edit or send a follow-up on error for slash commands
                try {
                    if (
                        (interaction as ChatInputCommandInteraction).deferred ||
                        (interaction as ChatInputCommandInteraction).replied
                    ) {
                        await (
                            interaction as ChatInputCommandInteraction
                        ).editReply(errorMessage);
                    } else {
                        await (
                            interaction as ChatInputCommandInteraction
                        ).reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (e) {
                    await (interaction as ChatInputCommandInteraction).followUp(
                        { content: errorMessage, ephemeral: true },
                    );
                }
            }
        }
    },
};
