import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    Role,
    PermissionsBitField,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

const formatDate = (date: Date): string => {
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
};

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("roleinfo")
        .setDescription("Displays detailed information about a specific role.")
        .addRoleOption((option) =>
            option
                .setName("role")
                .setDescription("The role to get information about")
                .setRequired(true),
        ),
    prefix: {
        aliases: ["roleinfo", "role", "ri"],
        usage: "<role_mention_or_id_or_name>",
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        if (
            !isPrefix &&
            !(interaction as ChatInputCommandInteraction).deferred
        ) {
            await (interaction as ChatInputCommandInteraction).deferReply();
        }

        try {
            let targetRole: Role | undefined | null = null;
            const guild = isPrefix
                ? (interaction as Message).guild
                : (interaction as ChatInputCommandInteraction).guild;

            if (!guild) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(
                        "This command can only be used in a server!",
                    );
                if (isPrefix) {
                    return (interaction as Message).reply({
                        embeds: [errorEmbed],
                    });
                } else {
                    return (
                        interaction as ChatInputCommandInteraction
                    ).editReply({
                        embeds: [errorEmbed],
                    });
                }
            }

            if (isPrefix) {
                const msg = interaction as Message;
                const prefixStr = process.env.PREFIX || "jam!";
                const args = msg.content
                    .slice(prefixStr.length)
                    .trim()
                    .split(/ +/);
                args.shift(); // command name
                const roleQuery = args.join(" ");

                if (!roleQuery) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor("#ff3838")
                        .setDescription(
                            `Please specify a role. Usage: \`${prefixStr}${this.prefix!.aliases[0]} ${this.prefix!.usage}\``,
                        );
                    return msg.reply({ embeds: [errorEmbed] });
                }

                // Try to find by mention, then ID, then name
                const roleMentionMatch = roleQuery.match(/^<@&(\d+)>$/);
                if (roleMentionMatch) {
                    targetRole = guild.roles.cache.get(roleMentionMatch[1]);
                } else {
                    targetRole =
                        guild.roles.cache.get(roleQuery) ||
                        guild.roles.cache.find(
                            (r) =>
                                r.name.toLowerCase() ===
                                roleQuery.toLowerCase(),
                        );
                }
            } else {
                targetRole = (
                    interaction as ChatInputCommandInteraction
                ).options.getRole("role") as Role;
            }

            if (!targetRole) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(
                        "❌ Role not found. Please check the name, ID, or mention.",
                    );
                if (isPrefix) {
                    return (interaction as Message).reply({
                        embeds: [errorEmbed],
                    });
                } else {
                    return (
                        interaction as ChatInputCommandInteraction
                    ).editReply({
                        embeds: [errorEmbed],
                    });
                }
            }

            const permissions = new PermissionsBitField(
                targetRole.permissions.bitfield,
            );
            const permsArray = permissions.toArray();
            let permsString = permsArray
                .map((p) =>
                    p
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (str) => str.toUpperCase()),
                )
                .join(", ");
            if (permsArray.includes("Administrator")) {
                permsString = "Administrator (All Permissions)";
            } else if (permsString.length > 1024) {
                permsString = `${permsArray.length} permissions (Too many to list).`;
            }
            if (!permsString) permsString = "None";

            const roleEmbed = new EmbedBuilder()
                .setTitle(`Role Information: ${targetRole.name}`)
                .setColor(
                    targetRole.hexColor === "#000000"
                        ? "#99aab5"
                        : targetRole.hexColor,
                ) // Use default if color is black
                .addFields(
                    { name: "🏷️ Name", value: targetRole.name, inline: true },
                    {
                        name: "🆔 ID",
                        value: `\`${targetRole.id}\``,
                        inline: true,
                    },
                    {
                        name: "🎨 Color",
                        value: `\`${targetRole.hexColor.toUpperCase()}\``,
                        inline: true,
                    },
                    {
                        name: "👥 Members",
                        value: targetRole.members.size.toLocaleString(),
                        inline: true,
                    },
                    {
                        name: "📈 Position",
                        value: targetRole.position.toString(),
                        inline: true,
                    }, // Raw position from bottom
                    {
                        name: "📌 Hoisting",
                        value: targetRole.hoist ? "Yes" : "No",
                        inline: true,
                    },
                    {
                        name: "🔗 Mentionable",
                        value: targetRole.mentionable ? "Yes" : "No",
                        inline: true,
                    },
                    {
                        name: "📅 Created At",
                        value: formatDate(targetRole.createdAt),
                        inline: false,
                    },
                    {
                        name: "📜 Permissions",
                        value: permsString,
                        inline: false,
                    },
                )
                .setFooter({
                    text: `Requested by ${isPrefix ? (interaction as Message).author.tag : (interaction as ChatInputCommandInteraction).user.tag}`,
                    iconURL: isPrefix
                        ? (interaction as Message).author.displayAvatarURL()
                        : (
                              interaction as ChatInputCommandInteraction
                          ).user.displayAvatarURL(),
                })
                .setTimestamp();

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [roleEmbed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [roleEmbed],
                });
            }
        } catch (error) {
            Logger.error("Roleinfo command failed:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An error occurred while fetching role information.",
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
