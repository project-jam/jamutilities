import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { textToMorse, morseToText } from "@projectjam/morse-translate";

// Regex to check if a string consists only of Morse code characters (dots, dashes, spaces, slashes)
const morseRegex = /^[.\-\s\/]+$/;

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("morse")
        .setDescription("Translates text to/from Morse code.")
        .addStringOption((option) =>
            option
                .setName("text")
                .setDescription("The text or Morse code to translate.")
                .setRequired(true),
        )
        .setDMPermission(true),

    prefix: {
        aliases: ["morse", "morsetranslate"],
        usage: "<text or morse code>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let inputText: string;

        // Get the input text from the interaction
        if (isPrefix) {
            const args = (interaction as Message).content.split(/\s+/).slice(1);
            if (args.length === 0) {
                const replyMessage =
                    "Please provide the text or Morse code you want to translate.";
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
            inputText = args.join(" "); // Join all arguments to get the full input string
        } else {
            inputText = (
                interaction as ChatInputCommandInteraction
            ).options.getString("text", true);
        }

        // Trim whitespace from the input
        const trimmedInput = inputText.trim();

        if (!trimmedInput) {
            const replyMessage =
                "Please provide some text or Morse code to translate.";
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

        try {
            // Defer reply for Slash Commands
            if (!isPrefix) {
                await (interaction as ChatInputCommandInteraction).deferReply();
            }

            let translatedText: string;
            let translationDirection: string;

            // Determine if the input is likely Morse code or plain text
            const isMorse = morseRegex.test(trimmedInput);

            if (isMorse) {
                // If it looks like Morse, translate to text
                translatedText = morseToText(trimmedInput);
                translationDirection = "Morse to Text";
            } else {
                // Otherwise, translate text to Morse
                translatedText = textToMorse(trimmedInput);
                translationDirection = "Text to Morse";
            }

            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle(`${translationDirection}`)
                .addFields(
                    {
                        name: "Original",
                        value: `\`\`\`\n${trimmedInput}\n\`\`\``,
                        inline: false,
                    },
                    {
                        name: "Translated",
                        value: `\`\`\`\n${translatedText}\n\`\`\``,
                        inline: false,
                    },
                )
                .setTimestamp()
                .setColor("#5865F2"); // A color often associated with Discord

            // Reply or edit the deferred reply with the embed
            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [embed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [embed],
                });
            }
        } catch (error: any) {
            console.error("Error translating morse code:", error);

            // Create an embed for the error message
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Translation Error")
                .setDescription(
                    `An error occurred during translation: ${error.message}`,
                )
                .setColor("#ff0000"); // Red color for errors

            // Send the error embed
            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                // Attempt to edit the reply if it was deferred, otherwise send a follow-up
                try {
                    if (
                        (interaction as ChatInputCommandInteraction).deferred ||
                        (interaction as ChatInputCommandInteraction).replied
                    ) {
                        await (
                            interaction as ChatInputCommandInteraction
                        ).editReply({ embeds: [errorEmbed] });
                    } else {
                        await (
                            interaction as ChatInputCommandInteraction
                        ).followUp({ embeds: [errorEmbed], ephemeral: true });
                    }
                } catch (e) {
                    await (interaction as ChatInputCommandInteraction).followUp(
                        { embeds: [errorEmbed], ephemeral: true },
                    );
                }
            }
        }
    },
};
