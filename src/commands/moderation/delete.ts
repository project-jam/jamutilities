import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    Role,
    GuildChannel,
    ChannelType,
    Message,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
    prefix: {
        aliases: ["delete", "del", "rm"],
        usage: "<role|channel> <name_to_delete> <confirm_name_again>",
    },
    data: new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Deletes server entities like roles or channels.")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels |
                PermissionFlagsBits.ManageRoles,
        )
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("role")
                .setDescription("Deletes an existing role.")
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("The role to delete")
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("confirm_role_name")
                        .setDescription(
                            "Type the exact role name to confirm deletion",
                        )
                        .setRequired(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("channel")
                .setDescription(
                    "Deletes an existing channel (text, voice, or category).",
                )
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The channel to delete")
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("confirm_channel_name")
                        .setDescription(
                            "Type the exact channel name to confirm deletion",
                        )
                        .setRequired(true),
                ),
        ),

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        const guild = isPrefix
            ? (interaction as Message).guild
            : interaction.guild;
        if (!guild) {
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("This command can only be used in a server.");
            if (isPrefix)
                return (interaction as Message).reply({ embeds: [errorEmbed] });
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const botMember = await guild.members.fetch(
            interaction.client.user!.id,
        );
        const member = isPrefix
            ? (interaction as Message).member
            : interaction.member;

        if (isPrefix) {
            const msg = interaction as Message;
            const prefixStr = process.env.PREFIX || "jam!";
            const args = msg.content.slice(prefixStr.length).trim().split(/ +/);
            const cmdName = args.shift()?.toLowerCase();
            if (!this.prefix!.aliases!.includes(cmdName!)) return;

            const entityType = args.shift()?.toLowerCase();
            const nameToDelete = args.shift();
            const confirmationName = args.shift();

            if (!entityType || !nameToDelete || !confirmationName) {
                return msg.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `Usage: ${prefixStr}${cmdName} <role|channel> <name> <confirm_name>`,
                            ),
                    ],
                });
            }

            try {
                if (entityType === "role") {
                    if (
                        !member?.permissions.has(
                            PermissionFlagsBits.ManageRoles,
                        )
                    ) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ You do not have permission to manage roles.",
                                    ),
                            ],
                        });
                    }
                    if (
                        !botMember.permissions.has(
                            PermissionFlagsBits.ManageRoles,
                        )
                    ) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ I don't have permission to manage roles.",
                                    ),
                            ],
                        });
                    }

                    const roleToDelete = guild.roles.cache.find(
                        (r) =>
                            r.name.toLowerCase() === nameToDelete.toLowerCase(),
                    );
                    if (!roleToDelete) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ Role "${nameToDelete}" not found.`,
                                    ),
                            ],
                        });
                    }
                    if (roleToDelete.name !== confirmationName) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ffcc00")
                                    .setTitle("⚠️ Deletion Not Confirmed")
                                    .setDescription(
                                        `The provided name "${confirmationName}" does not match the role name "${roleToDelete.name}". Deletion cancelled.`,
                                    ),
                            ],
                        });
                    }

                    await roleToDelete.delete(
                        `Role deleted by ${msg.author.tag} via prefix command`,
                    );
                    await msg.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#57F287")
                                .setTitle("✅ Role Deleted")
                                .setDescription(
                                    `Successfully deleted role: **${roleToDelete.name}**`,
                                ),
                        ],
                    });
                    Logger.info(
                        `User ${msg.author.id} deleted role "${roleToDelete.name}" via prefix in guild ${guild.id}`,
                    );
                } else if (entityType === "channel") {
                    if (
                        !member?.permissions.has(
                            PermissionFlagsBits.ManageChannels,
                        )
                    ) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ You do not have permission to manage channels.",
                                    ),
                            ],
                        });
                    }
                    if (
                        !botMember.permissions.has(
                            PermissionFlagsBits.ManageChannels,
                        )
                    ) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ I don't have permission to manage channels.",
                                    ),
                            ],
                        });
                    }

                    const channelToDelete = guild.channels.cache.find(
                        (c) =>
                            c.name.toLowerCase() === nameToDelete.toLowerCase(),
                    ) as GuildChannel | undefined;
                    if (!channelToDelete) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ Channel "${nameToDelete}" not found.`,
                                    ),
                            ],
                        });
                    }
                    if (channelToDelete.name !== confirmationName) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ffcc00")
                                    .setTitle("⚠️ Deletion Not Confirmed")
                                    .setDescription(
                                        `The provided name "${confirmationName}" does not match the channel name "${channelToDelete.name}". Deletion cancelled.`,
                                    ),
                            ],
                        });
                    }
                    if (!channelToDelete.deletable) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setTitle("❌ Channel Not Deletable")
                                    .setDescription(
                                        `I cannot delete the channel "${channelToDelete.name}".`,
                                    ),
                            ],
                        });
                    }

                    await channelToDelete.delete(
                        `Channel deleted by ${msg.author.tag} via prefix command`,
                    );
                    await msg.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#57F287")
                                .setTitle("✅ Channel Deleted")
                                .setDescription(
                                    `Successfully deleted channel: **${channelToDelete.name}**`,
                                ),
                        ],
                    });
                    Logger.info(
                        `User ${msg.author.id} deleted channel "${channelToDelete.name}" via prefix in guild ${guild.id}`,
                    );
                } else {
                    return msg.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "❌ Invalid entity type. Use 'role' or 'channel'.",
                                ),
                        ],
                    });
                }
            } catch (err) {
                Logger.error("Error during delete command execution:", err);
                return msg.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "❌ An error occurred while trying to delete the entity.",
                            ),
                    ],
                });
            }
        }
    },
};
