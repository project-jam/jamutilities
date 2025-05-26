import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    User, // Import User type
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("dicksize")
        .setDescription("Measures... something.")
        .addUserOption(
            (
                option, // Allow mentioning a user for slash command
            ) =>
                option
                    .setName("user")
                    .setDescription(
                        "The user to measure (defaults to yourself)",
                    )
                    .setRequired(false), // Not required, defaults to author
        )
        .setDMPermission(true),

    prefix: {
        aliases: ["dicksize", "dickmesure"], // Added a 'measure' alias too
        usage: "[@user]", // Usage for prefix command
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let targetUser: User;

        // Determine the target user
        if (isPrefix) {
            // For prefix commands, check for mentions first
            targetUser =
                (interaction as Message).mentions.users.first() ||
                (interaction as Message).author;
        } else {
            // For slash commands, get the user option or default to the interaction user
            targetUser =
                (interaction as ChatInputCommandInteraction).options.getUser(
                    "user",
                ) || (interaction as ChatInputCommandInteraction).user;
        }

        try {
            // Defer reply for Slash Commands
            if (!isPrefix) {
                await (interaction as ChatInputCommandInteraction).deferReply();
            }

            // Get the user's ID
            const userId = targetUser.id;

            // Calculate size based on the last three digits of the user ID
            // Extract the last three digits, parse as integer. Use 0 if ID is too short.
            const lastThreeDigits = parseInt(userId.slice(-3)) || 0;
            const size = (lastThreeDigits % 20) + 1; // Result will be between 1 and 20

            // Convert size to inches (assuming the original logic intended cm to inches or similar scaling)
            // Original logic: size / 2.54. Let's keep that for consistency with your source.
            const sizeInches = size / 2.54;

            // Create the embed
            const embed = new EmbedBuilder().setDescription(
                `${sizeInches.toFixed(2)} inch\n8${"=".repeat(size)}D`,
            ); // Format the description

            // Reply or edit the deferred reply with the embed
            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [embed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [embed],
                });
            }
        } catch (error: any) {
            console.error("Error executing oyeah command:", error);

            // Create an embed for the error message
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Command Error")
                .setDescription(
                    `An error occurred while executing the command: ${error.message}`,
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
