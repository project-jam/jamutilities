import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

const JOKE_API_URL =
    "https://sv443.net/jokeapi/v2/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("joke")
        .setDescription("Fetches a random joke")
        .setDMPermission(true),

    prefix: {
        aliases: ["joke", "pun"],
        usage: "",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            // Defer reply for Slash Commands
            if (!isPrefix) {
                await (interaction as ChatInputCommandInteraction).deferReply();
            }

            // Fetch joke data from the API
            const response = await fetch(JOKE_API_URL);

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const jokeData = await response.json();

            // Check for API errors in the response body
            if (jokeData.error) {
                throw new Error(
                    `API returned an error: ${jokeData.message || "Unknown API error"}`,
                );
            }

            let jokeText = "";
            if (jokeData.type === "single") {
                jokeText = jokeData.joke;
            } else if (jokeData.type === "twopart") {
                jokeText = `${jokeData.setup}\n\n||${jokeData.delivery}||`; // Use spoiler tags for the punchline
            } else {
                throw new Error("Received unexpected joke format from API.");
            }

            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle("😄 Here's a joke!")
                .setDescription(jokeText)
                .setFooter({
                    text: `Category: ${jokeData.category || "Unknown"}`,
                })
                .setTimestamp()
                .setColor("#00b0f4"); // A nice blue color

            // Reply or edit the deferred reply with the embed
            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [embed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [embed],
                });
            }
        } catch (error: any) {
            console.error("Error fetching joke:", error);

            // Create an embed for the error message
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Joke Error")
                .setDescription(`Failed to fetch a joke: ${error.message}`)
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
                        ).reply({ embeds: [errorEmbed], ephemeral: true });
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
