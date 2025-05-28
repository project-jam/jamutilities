import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { getAverageColor } from "fast-average-color-node";
import fetch from "node-fetch";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("banner")
        .setDescription("Shows user's banner or generated background")
        .setDMPermission(true)
        .addUserOption((opt) =>
            opt
                .setName("user")
                .setDescription("The user whose banner/background to show")
                .setRequired(false),
        )
        .addBooleanOption((opt) =>
            opt
                .setName("usrbg")
                .setDescription(
                    "Show generated background when no banner (default true)",
                )
                .setRequired(false),
        ),

    prefix: {
        aliases: ["banner", "userbanner"],
        usage: "[@user] [usrbg:false]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let user;
            let showUsrbg = true;

            if (interaction instanceof Message) {
                user = interaction.mentions.users.first() || interaction.author;
                const content = interaction.content.toLowerCase();
                if (
                    content.includes("usrbg:false") ||
                    content.includes("usrbg=0")
                ) {
                    showUsrbg = false;
                }
            } else {
                await interaction.deferReply();
                user = interaction.options.getUser("user") || interaction.user;
                showUsrbg = interaction.options.getBoolean("usrbg") ?? true;
            }

            const fetched = await user.fetch();
            const discordBanner = fetched.bannerURL({
                size: 4096,
                dynamic: true,
            });

            console.log(
                `User: ${user.tag}, Banner URL: ${discordBanner}, Show Usrbg: ${showUsrbg}`,
            );

            let finalUrl: string | null = null;
            if (discordBanner) {
                finalUrl = discordBanner;
            } else if (showUsrbg) {
                const usrbgUrl = `https://usrbg.is-hardly.online/usrbg/v2/${user.id}`;
                try {
                    const res = await fetch(usrbgUrl);
                    const ct = res.headers.get("content-type") || "";
                    console.log(
                        `Usrbg URL: ${usrbgUrl}, Response Status: ${res.status}, Content-Type: ${ct}`,
                    );
                    if (
                        res.ok &&
                        (ct === "image/gif" || ct.startsWith("image/"))
                    ) {
                        finalUrl = usrbgUrl;
                    } else {
                        console.log(`Failed to fetch usrbg: ${res.statusText}`);
                    }
                } catch (error) {
                    console.error(`Error fetching usrbg: ${error}`);
                }
            }

            console.log(`Final URL: ${finalUrl}`);

            if (!finalUrl) {
                const noEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(`❌ ${user.username} has no banner.`);
                if (interaction instanceof Message) {
                    return await interaction.reply({ embeds: [noEmbed] });
                }
                return await interaction.editReply({ embeds: [noEmbed] });
            }

            // Fetch average color
            let colorHex = "#2b2d31";
            try {
                const color = await getAverageColor(finalUrl);
                colorHex = color.hex;
            } catch {
                /* fallback */
            }

            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Banner`)
                .setImage(finalUrl)
                .setColor(colorHex)
                .setTimestamp();

            if (interaction instanceof Message) {
                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (err) {
            console.error(`Error in banner command: ${err}`);
            const errEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Error fetching banner/background.");
            if (interaction instanceof Message) {
                await interaction.reply({ embeds: [errEmbed] });
            } else {
                await interaction.editReply({ embeds: [errEmbed] });
            }
        }
    },
};
