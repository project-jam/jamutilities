import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("invite")
        .setDMPermission(true)
        .setDescription("Get the JamUtilities bot invite link"),

    prefix: {
        aliases: ["invite", "inv"],
        usage: "",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        // Determine client ID dynamically
        const clientId = interaction.client.user?.id;
        if (!clientId) {
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Error")
                .setDescription("Could not find JamUtilities client ID.")
                .setColor("#f04747");
            if (isPrefix) {
                return (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                return (interaction as ChatInputCommandInteraction).reply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            }
        }

        // Build invite URL with scopes for slash commands & bot
        const inviteURL = new URL("https://discord.com/oauth2/authorize");
        inviteURL.searchParams.set("client_id", clientId);
        inviteURL.searchParams.set("permissions", "8");
        inviteURL.searchParams.set("scope", "bot applications.commands");

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle("🔗 Invite JamUtilities & our server!")
            .setDescription(
                `Click [here](${inviteURL.toString()}) to invite JamUtilities to your server.\n` +
                    `And join our server, [here](https://discord.gg/axDmanhNhs).
                    `,
            )
            .setColor("#5865F2")
            .setTimestamp()
            .setFooter({ text: "Thank you for using JamUtilities!" });

        // Reply appropriately
        if (isPrefix) {
            await (interaction as Message).reply({ embeds: [embed] });
        } else {
            await (interaction as ChatInputCommandInteraction).reply({
                embeds: [embed],
                ephemeral: false,
            });
        }
    },
};
