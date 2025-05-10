import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    PermissionsBitField,
    ChannelType,
    TextChannel,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import ms from "ms"; // We'll use the 'ms' library for easy time string parsing

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Sets or removes slowmode in the current channel.")
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription(
                    "Slowmode duration (e.g., 5s, 10m, 1h, 2h30m). Type '0' or 'off' to disable.",
                )
                .setRequired(true),
        )
        .setDMPermission(false),
    prefix: {
        aliases: ["slowmode", "sm"],
        usage: "<duration (e.g., 5s, 10m, 0 to disable)>",
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let durationString: string;
        let channel: TextChannel;
        let memberPermissions: Readonly<PermissionsBitField> | null;
        let guildId: string | null;
        let authorId: string;

        try {
            if (isPrefix) {
                const msg = interaction as Message;
                if (!msg.guild || msg.channel.type !== ChannelType.GuildText) {
                    return msg.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "This command can only be used in server text channels.",
                                ),
                        ],
                    });
                }
                channel = msg.channel as TextChannel;
                guildId = msg.guild.id;
                authorId = msg.author.id;
                memberPermissions = msg.member?.permissions ?? null;

                const prefixStr = process.env.PREFIX || "jam!";
                const args = msg.content
                    .slice(prefixStr.length)
                    .trim()
                    .split(/ +/);
                args.shift(); // Remove command name
                durationString = args.join(" ");

                if (!durationString) {
                    return msg.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `❌ Please provide a duration. Usage: \`${prefixStr}slowmode <duration>\``,
                                ),
                        ],
                    });
                }
            } else {
                const slash = interaction as ChatInputCommandInteraction;
                if (
                    !slash.guild ||
                    slash.channel?.type !== ChannelType.GuildText
                ) {
                    return slash.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "This command can only be used in server text channels.",
                                ),
                        ],
                        ephemeral: true,
                    });
                }
                channel = slash.channel as TextChannel;
                guildId = slash.guild.id;
                authorId = slash.user.id;
                memberPermissions = slash.member
                    ?.permissions as PermissionsBitField;
                durationString = slash.options.getString("duration", true);
            }

            if (!memberPermissions) {
                const errMsg = "Could not verify your permissions.";
                const errorEmbed = new EmbedBuilder().setColor("#ff3838").setDescription(errMsg);
                if (isPrefix) return (interaction as Message).reply({ embeds: [errorEmbed] });
                return (interaction as ChatInputCommandInteraction).reply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            }

            if (
                !memberPermissions.has(PermissionsBitField.Flags.ManageChannels)
            ) {
                const errMsg =
                    "❌ You do not have permission to manage channels.";
                const errorEmbed = new EmbedBuilder().setColor("#ff3838").setDescription(errMsg);
                if (isPrefix) return (interaction as Message).reply({ embeds: [errorEmbed] });
                return (interaction as ChatInputCommandInteraction).reply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            }

            const botMember = await channel.guild.members.fetch(
                interaction.client.user!.id,
            );
            if (
                !botMember
                    .permissionsIn(channel)
                    .has(PermissionsBitField.Flags.ManageChannels)
            ) {
                const errMsg =
                    "❌ I do not have permission to manage this channel.";
                const errorEmbed = new EmbedBuilder().setColor("#ff3838").setDescription(errMsg);
                Logger.warn(
                    `Missing ManageChannels permission for bot in channel ${channel.id}, guild ${guildId}`,
                );
                if (isPrefix) return (interaction as Message).reply({ embeds: [errorEmbed] });
                return (interaction as ChatInputCommandInteraction).reply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            }

            let seconds = 0;
            if (
                durationString.toLowerCase() === "off" ||
                durationString === "0"
            ) {
                seconds = 0;
            } else {
                try {
                    const milliseconds = ms(durationString);
                    if (milliseconds === undefined || isNaN(milliseconds) || milliseconds < 0) { // Also check for negative from ms parsing
                        throw new Error("Invalid or negative time string");
                    }
                    seconds = Math.floor(milliseconds / 1000);
                } catch (e) {
                    const errMsg =
                        "❌ Invalid duration format. Use units like s, m, h, d (e.g., '10s', '5m', '1h'). '0' or 'off' to disable.";
                     const errorEmbed = new EmbedBuilder().setColor("#ff3838").setDescription(errMsg);
                    if (isPrefix) return (interaction as Message).reply({ embeds: [errorEmbed] });
                    return (interaction as ChatInputCommandInteraction).reply({
                        embeds: [errorEmbed],
                        ephemeral: true,
                    });
                }
            }

            const MAX_SLOWMODE_SECONDS = 21600; // 6 hours
            if (seconds > MAX_SLOWMODE_SECONDS) { // seconds will not be negative due to check above
                const errMsg = `❌ Duration must be between 0 seconds and 6 hours (${ms(MAX_SLOWMODE_SECONDS * 1000, { long: true })}). You tried: ${ms(seconds * 1000, { long: true })}`;
                const errorEmbed = new EmbedBuilder().setColor("#ff3838").setDescription(errMsg);
                if (isPrefix) return (interaction as Message).reply({ embeds: [errorEmbed] });
                return (interaction as ChatInputCommandInteraction).reply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            }

            await channel.setRateLimitPerUser(
                seconds,
                `Action by: ${authorId} (${(interaction.member as GuildMember)?.displayName || authorId})`,
            );

            const successMsg =
                seconds > 0
                    ? `✅ Slowmode set to ${ms(seconds * 1000, { long: true })} in this channel.`
                    : "✅ Slowmode has been disabled in this channel.";
            const successEmbed = new EmbedBuilder().setColor(seconds > 0 ? "#57F287" : "#5865F2").setDescription(successMsg);

            Logger.info(
                `User ${authorId} ${seconds > 0 ? "set slowmode to " + seconds + "s" : "disabled slowmode"} in channel ${channel.id}, guild ${guildId}`,
            );

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [successEmbed] });
            } else {
                await (interaction as ChatInputCommandInteraction).reply({
                    embeds: [successEmbed],
                    ephemeral: false, // Success message should be visible
                });
            }
        } catch (err: any) {
            Logger.error("Slowmode command error:", err);
            const errMsg =
                "😢 Oops, something went wrong while trying to set slowmode.";
            const errorEmbed = new EmbedBuilder().setColor("#ff3838").setDescription(errMsg);

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                const slashInteraction =
                    interaction as ChatInputCommandInteraction;
                if (slashInteraction.replied || slashInteraction.deferred) {
                    await slashInteraction.editReply({ embeds: [errorEmbed] });
                } else {
                    await slashInteraction.reply({
                        embeds: [errorEmbed],
                        ephemeral: true,
                    });
                }
            }
        }
    },
};
