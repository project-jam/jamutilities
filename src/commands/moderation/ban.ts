import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    Message,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user from the server")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The user to ban")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("reason").setDescription("The reason for the ban"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    prefix: {
        aliases: ["ban", "banish"],
        usage: "<user> [reason]", // Example: jam!ban @user spamming
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let user;
            let reason = "No reason provided";
            let guild;
            let executor;

            if (isPrefix) {
                const message = interaction as Message;
                guild = message.guild;
                executor = message.member;

                // Check permissions
                if (
                    !message.member?.permissions.has(
                        PermissionFlagsBits.BanMembers,
                    )
                ) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You don't have permission to ban members!",
                                ),
                        ],
                    });
                    return;
                }

                const args = message.content.split(/ +/).slice(1);

                if (args.length < 1) {
                    const prefix = process.env.PREFIX || "jam!";
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Please provide a user to ban!",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: command.prefix.aliases
                                        .map(
                                            (alias) =>
                                                `${prefix}${alias} <user> [reason]`,
                                        )
                                        .concat(
                                            "Example: `jam!ban @user spamming`",
                                        )
                                        .join("\n"),
                                }),
                        ],
                    });
                    return;
                }

                user = message.mentions.users.first();
                if (!user) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Please mention a valid user to ban!",
                                ),
                        ],
                    });
                    return;
                }

                if (args.length > 1) {
                    reason = args.slice(1).join(" ");
                }
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                await slashInteraction.deferReply();
                guild = slashInteraction.guild;
                executor = slashInteraction.member;
                user = slashInteraction.options.getUser("user", true);
                reason =
                    slashInteraction.options.getString("reason") ||
                    "No reason provided";
            }

            // Check if the user is in the guild
            const member = guild?.members.cache.get(user.id);
            if (!member) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ This user is not in the server!");

                if (isPrefix) {
                    await (interaction as Message).reply({
                        embeds: [errorEmbed],
                    });
                } else {
                    await (
                        interaction as ChatInputCommandInteraction
                    ).editReply({
                        embeds: [errorEmbed],
                    });
                }
                return;
            }

            // Check if the bot has permission to ban the user
            if (
                !guild?.members.me?.permissions.has(
                    PermissionFlagsBits.BanMembers,
                )
            ) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(
                        "❌ I don't have permission to ban members!",
                    );

                if (isPrefix) {
                    await (interaction as Message).reply({
                        embeds: [errorEmbed],
                    });
                } else {
                    await (
                        interaction as ChatInputCommandInteraction
                    ).editReply({
                        embeds: [errorEmbed],
                    });
                }
                return;
            }

            // Perform the ban
            await member.ban({ reason });

            // Create success embed
            const banEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setTitle("🔨 User Banned")
                .setDescription(`Successfully banned **${user.tag}**`)
                .addFields(
                    {
                        name: "Banned User",
                        value: `${user.tag} (${user.id})`,
                        inline: true,
                    },
                    {
                        name: "Banned By",
                        value: executor?.user.tag || "Unknown",
                        inline: true,
                    },
                    { name: "Reason", value: reason },
                )
                .setTimestamp();

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [banEmbed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [banEmbed],
                });
            }

            // Try to DM the banned user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setTitle("You've Been Banned")
                    .setDescription(`You have been banned from ${guild?.name}`)
                    .addFields(
                        {
                            name: "Banned By",
                            value: executor?.user.tag || "Unknown",
                        },
                        { name: "Reason", value: reason },
                    )
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
            } catch (error) {
                Logger.warn(`Could not DM banned user ${user.tag}`);
            }
        } catch (error) {
            Logger.error("Ban command failed:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An error occurred while trying to ban the user.",
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
