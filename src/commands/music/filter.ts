import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { DistubeHandler } from "../../handlers/distubeHandler";
import { DisTubeError, defaultFilters, Filter } from "distube";

// Available DisTube audio filters for display
const availableFilters: { name: string; key: string }[] = [
    { name: "3D", key: "3d" },
    { name: "Bass Boost", key: "bassboost" },
    { name: "Chorus", key: "chorus" },
    { name: "Earwax", key: "earwax" },
    { name: "Echo", key: "echo" },
    { name: "Flanger", key: "flanger" },
    { name: "Gate", key: "gate" },
    { name: "Haas", key: "haas" },
    { name: "Karaoke", key: "karaoke" },
    { name: "Nightcore", key: "nightcore" },
    { name: "Normalizer", key: "normalizer" },
    { name: "Phaser", key: "phaser" },
    { name: "Pitch", key: "pitch" },
    { name: "Pulsator", key: "pulsator" },
    { name: "Reverse", key: "reverse" },
    { name: "Speed", key: "speed" },
    { name: "Surround", key: "surround" },
    { name: "Treble", key: "treble" },
    { name: "Tremolo", key: "tremolo" },
    { name: "Vaporwave", key: "vaporwave" },
];

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("filter")
        .setDescription("Applies or clears audio filters for the music.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription(
                    "The filter to apply, 'clear' to remove all, 'list' to view.",
                )
                .setRequired(true)
                .addChoices(
                    ...availableFilters.map((f) => ({
                        name: f.name,
                        value: f.key,
                    })),
                ),
        ),
    prefix: {
        aliases: ["filter", "filters", "fx"],
        usage: "<filter_name|clear|list>",
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            const distube = DistubeHandler.getInstance(
                interaction.client,
            ).distube;
            let member: GuildMember;
            let reply: (options: any) => Promise<any>;
            let deferReply: (() => Promise<any>) | null = null;
            let filterKey: string;

            // Determine context (prefix vs slash)
            if (isPrefix) {
                const msg = interaction as Message;
                if (!msg.guild || !msg.member)
                    return msg.reply("Command must be used in a server.");
                member = msg.member;
                reply = msg.reply.bind(msg);
                const args = msg.content.trim().split(/ +/).slice(1);
                if (!args.length) {
                    const queue = distube.getQueue(msg.guild);
                    const active = queue?.filters.names.join(", ") || "None";
                    return reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#4f74c8")
                                .setTitle("🎧 Audio Filters")
                                .setDescription(`Active: **${active}**`)
                                .addFields(
                                    {
                                        name: "Usage",
                                        value: `${process.env.PREFIX || "jam!"}filter <name|clear|list>`,
                                    },
                                    {
                                        name: "Available",
                                        value: availableFilters
                                            .map((f) => f.key)
                                            .join(", "),
                                    },
                                ),
                        ],
                    });
                }
                filterKey = args[0].toLowerCase();
            } else {
                const slash = interaction as ChatInputCommandInteraction;
                if (!slash.guild || !slash.member)
                    return slash.reply({
                        content: "Must be used in a server.",
                        ephemeral: true,
                    });
                member = slash.member as GuildMember;
                filterKey = slash.options.getString("name", true).toLowerCase();
                deferReply = slash.deferReply.bind(slash);
                await deferReply();
                reply = slash.editReply.bind(slash);
            }

            // Voice & queue check
            if (!member.voice.channel) {
                return reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("You must join a voice channel."),
                    ],
                    ephemeral: !isPrefix,
                });
            }
            const queue = distube.getQueue(member.guild!);
            if (!queue) {
                return reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription("Nothing is playing right now."),
                    ],
                    ephemeral: !isPrefix,
                });
            }

            // 'list' command
            if (filterKey === "list" && isPrefix) {
                const active = queue.filters.names.join(", ") || "None";
                return reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#4f74c8")
                            .setTitle("🎧 Audio Filters")
                            .setDescription(`Active: **${active}**`)
                            .addFields({
                                name: "Available",
                                value: availableFilters
                                    .map((f) => f.key)
                                    .join(", "),
                            }),
                    ],
                });
            }

            // Clear filters
            if (filterKey === "clear") {
                if (queue.filters.size === 0) {
                    return reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ffae42")
                                .setDescription("No filters to clear."),
                        ],
                    });
                }
                await queue.filters.clear();
                return reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#2b2d31")
                            .setDescription("✅ All filters cleared."),
                    ],
                });
            }

            // Match against defaultFilters case-insensitively
            const actualKey = (Object.keys(defaultFilters) as string[]).find(
                (k) => k.toLowerCase() === filterKey,
            );
            if (!actualKey) {
                return reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(`Invalid filter: **${filterKey}**`)
                            .addFields({
                                name: "Available",
                                value: availableFilters
                                    .map((f) => f.key)
                                    .join(", "),
                            }),
                    ],
                });
            }

            // Find display name
            const filterDef = availableFilters.find(
                (f) => f.key.toLowerCase() === filterKey,
            )!;

            // Build Filter object
            const filterObj: Filter = {
                name: actualKey,
                value: defaultFilters[actualKey as keyof typeof defaultFilters],
            };

            // Toggle filter
            try {
                if (queue.filters.has(filterObj)) {
                    await queue.filters.remove(filterObj);
                    const active = queue.filters.names.join(", ") || "None";
                    return reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `Removed: **${filterDef.name}**. Active: **${active}**`,
                                ),
                        ],
                    });
                } else {
                    await queue.filters.add(filterObj);
                    const active = queue.filters.names.join(", ") || "None";
                    return reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#2b2d31")
                                .setDescription(
                                    `Applied: **${filterDef.name}**. Active: **${active}**`,
                                ),
                        ],
                    });
                }
            } catch (err: any) {
                Logger.error(`Filter error (${actualKey}):`, err);
                const msg =
                    err instanceof DisTubeError &&
                    err.message.includes("not a valid filter")
                        ? `Invalid filter: **${filterKey}**.`
                        : `Error: ${err.message || "Unknown error"}`;
                return reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(msg),
                    ],
                });
            }
        } catch (err: any) {
            Logger.error("Filter command failed:", err);
            const embed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("An unexpected error occurred.");
            if (isPrefix) (interaction as Message).reply({ embeds: [embed] });
            else {
                const slash = interaction as ChatInputCommandInteraction;
                if (slash.replied || slash.deferred)
                    slash.editReply({ embeds: [embed] });
                else slash.reply({ embeds: [embed], ephemeral: true });
            }
        }
    },
};
