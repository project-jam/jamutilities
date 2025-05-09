import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("removetimeout")
        .setDescription("Remove a timeout from a user")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The user to remove timeout from")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("The reason for removing the timeout"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    prefix: {
        aliases: ["removetimeout", "untimeout", "rto"],
        usage: "<@user> [reason]", // Example: jam!untimeout @user behaving now
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let targetUser;
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
                        PermissionFlagsBits.ModerateMembers,
                    )
                ) {
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ You don't have permission to remove timeouts!",
                                ),
                        ],
                    });
                    return;
                }

                // Parse user mention and reason
                targetUser = message.mentions.users.first();
                if (!targetUser) {
                    const prefix = process.env.PREFIX || "jam!";
                    await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Please mention a user to remove timeout from!",
                                )
                                .addFields({
                                    name: "Usage",
                                    value: command.prefix.aliases
                                        .map(
                                            (alias) =>
                                                `${prefix}${alias} <@user> [reason]`,
                                        )
                                        .concat(
                                            "Example: `jam!untimeout @user behaving now`",
                                        )
                                        .join("\n"),
                                }),
                        ],
                    });
                    return;
                }

                const args = message.content.split(/ +/).slice(1);
                if (args.length > 1) {
                    reason = args.slice(1).join(" ");
                }
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                await slashInteraction.deferReply();
                guild = slashInteraction.guild;
                executor = slashInteraction.member;
                targetUser = slashInteraction.options.getUser("user");
                reason =
                    slashInteraction.options.getString("reason") ||
                    "No reason provided";
            }

            if (!targetUser || !guild) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Please specify a valid user!");

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

            // Get target member
            const targetMember = await guild.members.fetch(targetUser.id);

            if (!targetMember) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ Failed to fetch member information!");

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

            // Check if the target is actually timed out
            if (!targetMember.isCommunicationDisabled()) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ This user is not timed out!");

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

            // Self-timeout removal check
            if (
                targetUser.id ===
                (isPrefix
                    ? (interaction as Message).author.id
                    : (interaction as ChatInputCommandInteraction).user.id)
            ) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("❌ You cannot remove your own timeout!");

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

            // Role hierarchy check
            if (
                targetMember.roles.highest.position >=
                (executor as any).roles.highest.position
            ) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(
                        "❌ You cannot remove a timeout from someone with an equal or higher role than you!",
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

            // Try to DM the user
            try {
                const executorTag = isPrefix
                    ? (interaction as Message).author.tag
                    : (interaction as ChatInputCommandInteraction).user.tag;

                const dmEmbed = new EmbedBuilder()
                    .setColor("#00ff00")
                    .setTitle("Timeout Removed")
                    .setDescription(
                        `Your timeout in ${guild.name} has been removed`,
                    )
                    .addFields(
                        { name: "Removed By", value: executorTag },
                        { name: "Reason", value: reason },
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                Logger.warn(
                    `Could not DM user ${targetUser.tag} about timeout removal`,
                );
            }

            // Format the removal reason
            const executorTag = isPrefix
                ? (interaction as Message).author.tag
                : (interaction as ChatInputCommandInteraction).user.tag;
            const executorId = isPrefix
                ? (interaction as Message).author.id
                : (interaction as ChatInputCommandInteraction).user.id;
            const formattedReason = `Timeout removed by ${executorTag} (${executorId}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

            // Remove the timeout
            await targetMember.timeout(null, formattedReason);

            // Create success embed
            const successEmbed = new EmbedBuilder()
                .setColor("#00ff00")
                .setTitle("⏰ Timeout Removed")
                .setDescription(
                    `Successfully removed timeout from **${targetUser.tag}**`,
                )
                .addFields(
                    {
                        name: "User",
                        value: `${targetUser.tag} (${targetUser.id})`,
                        inline: true,
                    },
                    {
                        name: "Removed By",
                        value: executorTag,
                        inline: true,
                    },
                    { name: "Reason", value: reason },
                )
                .setTimestamp();

            if (isPrefix) {
                await (interaction as Message).reply({
                    embeds: [successEmbed],
                });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [successEmbed],
                });
            }
        } catch (error) {
            Logger.error("Remove timeout command failed:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An error occurred while trying to remove the timeout.",
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
