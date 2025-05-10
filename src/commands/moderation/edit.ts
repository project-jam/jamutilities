import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChatInputCommandInteraction,
    Role,
    Attachment,
    ChannelType,
    CategoryChannel,
    TextChannel,
    VoiceChannel,
    GuildChannelEditOptions,
    GuildChannelResolvable,
    HexColorString,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import axios from "axios"; // For fetching image buffer for role icons

// Helper to parse key:value pairs with simple quote handling for prefix commands
const parsePrefixEditArgs = (args: string[]): Record<string, string> => {
    const options: Record<string, string> = {};
    let currentKey = "";
    let currentValue = "";
    let inQuotes = false;

    // Join and split on ':' to separate key/value segments
    for (const segment of args.join(" ").split(":")) {
        const trimmed = segment.trim();
        if (!currentKey) {
            currentKey = trimmed;
            continue;
        }

        // Split off the potential next key
        const parts = trimmed.split(/\s+/);
        let val = parts.shift()!;
        if (val.startsWith('"')) {
            inQuotes = true;
            val = val.slice(1);
        }

        if (inQuotes) {
            // Accumulate until closing quote
            while (parts.length && !val.endsWith('"')) {
                val += " " + parts.shift()!;
            }
            if (val.endsWith('"')) {
                inQuotes = false;
                val = val.slice(0, -1);
            }
        }

        currentValue = val;
        options[currentKey.toLowerCase()] = currentValue;

        // Prepare next key
        currentKey = parts.join(" ").trim();
        currentValue = "";
    }

    return options;
};

export const command: Command = {
    prefix: {
        aliases: ["edit", "modify"],
        usage: "<role|textchannel|voicechannel|category> <current_name_or_id> <option:value> [...]",
    },

    data: new SlashCommandBuilder()
        .setName("edit")
        .setDescription(
            "Edits existing server entities like roles or channels.",
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageChannels |
                PermissionFlagsBits.ManageRoles,
        )
        .setDMPermission(false)

        // ----- ROLE EDIT -----
        .addSubcommand((sub) =>
            sub
                .setName("role")
                .setDescription("Edits an existing role.")
                .addRoleOption((o) =>
                    o
                        .setName("role")
                        .setDescription("The role to edit")
                        .setRequired(true),
                )
                .addStringOption((o) =>
                    o
                        .setName("new_name")
                        .setDescription("The new name for the role")
                        .setRequired(false),
                )
                .addStringOption((o) =>
                    o
                        .setName("color")
                        .setDescription(
                            "New hex color (e.g., #FF0000, 'random', or 'remove')",
                        )
                        .setRequired(false),
                )
                .addBooleanOption((o) =>
                    o
                        .setName("hoist")
                        .setDescription("New hoist status (true/false)")
                        .setRequired(false),
                )
                .addBooleanOption((o) =>
                    o
                        .setName("mentionable")
                        .setDescription("New mentionable status (true/false)")
                        .setRequired(false),
                )
                .addAttachmentOption((o) =>
                    o
                        .setName("icon")
                        .setDescription(
                            "New image icon for the role (Server Level 2+ for visibility)",
                        )
                        .setRequired(false),
                )
                .addBooleanOption((o) =>
                    o
                        .setName("clear_icon")
                        .setDescription(
                            "Set to true to remove the current role icon",
                        )
                        .setRequired(false),
                ),
        )

        // ----- TEXT CHANNEL EDIT -----
        .addSubcommand((sub) =>
            sub
                .setName("textchannel")
                .setDescription("Edits an existing text channel.")
                .addChannelOption((o) =>
                    o
                        .setName("channel")
                        .setDescription("The text channel to edit")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((o) =>
                    o
                        .setName("new_name")
                        .setDescription("The new name for the text channel")
                        .setRequired(false),
                )
                .addStringOption((o) =>
                    o
                        .setName("topic")
                        .setDescription(
                            "The new topic (use 'remove' or 'clear' to remove)",
                        )
                        .setRequired(false),
                )
                .addChannelOption((o) =>
                    o
                        .setName("category")
                        .setDescription(
                            "The new parent category (select no category to remove)",
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                ),
        )

        // ----- VOICE CHANNEL EDIT -----
        .addSubcommand((sub) =>
            sub
                .setName("voicechannel")
                .setDescription("Edits an existing voice channel.")
                .addChannelOption((o) =>
                    o
                        .setName("channel")
                        .setDescription("The voice channel to edit")
                        .addChannelTypes(ChannelType.GuildVoice)
                        .setRequired(true),
                )
                .addStringOption((o) =>
                    o
                        .setName("new_name")
                        .setDescription("The new name for the voice channel")
                        .setRequired(false),
                )
                .addChannelOption((o) =>
                    o
                        .setName("category")
                        .setDescription(
                            "The new parent category (select no category to remove)",
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addIntegerOption((o) =>
                    o
                        .setName("user_limit")
                        .setDescription("New user limit (0 for no limit)")
                        .setMinValue(0)
                        .setMaxValue(99)
                        .setRequired(false),
                )
                .addIntegerOption((o) =>
                    o
                        .setName("bitrate")
                        .setDescription("New bitrate in Kbps (e.g., 64)")
                        .setMinValue(8)
                        .setRequired(false),
                ),
        )

        // ----- CATEGORY EDIT -----
        .addSubcommand((sub) =>
            sub
                .setName("category")
                .setDescription("Edits an existing channel category.")
                .addChannelOption((o) =>
                    o
                        .setName("channel")
                        .setDescription("The category to edit")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true),
                )
                .addStringOption((o) =>
                    o
                        .setName("new_name")
                        .setDescription("The new name for the category")
                        .setRequired(false),
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
            const err = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("This command can only be used in a server.");
            return isPrefix
                ? (interaction as Message).reply({ embeds: [err] })
                : interaction.reply({ embeds: [err], ephemeral: true });
        }

        const botMember = await guild.members.fetch(
            interaction.client.user!.id,
        );
        const member = isPrefix
            ? (interaction as Message).member
            : interaction.member;
        const perms = member?.permissions as typeof PermissionFlagsBits;

        // Prefix-handler block
        if (isPrefix) {
            const msg = interaction as Message;
            const prefix = process.env.PREFIX ?? "jam!";
            const raw = msg.content.slice(prefix.length).trim().split(/\s+/);
            const cmd = raw.shift()?.toLowerCase();
            if (!this.prefix!.aliases!.includes(cmd!)) return;
            const entityType = raw.shift()?.toLowerCase();
            const targetId = raw.shift();
            if (!entityType || !targetId || raw.length === 0) {
                return msg.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `Invalid syntax. Usage: ${prefix}${cmd} ${this.prefix!.usage}`,
                            ),
                    ],
                });
            }

            const opts = parsePrefixEditArgs(raw);
            let changes = false;

            try {
                // ROLE
                if (entityType === "role") {
                    if (
                        !perms.has(PermissionFlagsBits.ManageRoles) ||
                        !botMember.permissions.has(
                            PermissionFlagsBits.ManageRoles,
                        )
                    ) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ Missing Manage Roles permission.",
                                    ),
                            ],
                        });
                    }

                    const role =
                        guild.roles.cache.get(targetId) ||
                        guild.roles.cache.find(
                            (r) =>
                                r.name.toLowerCase() === targetId.toLowerCase(),
                        );
                    if (!role) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ Role "${targetId}" not found.`,
                                    ),
                            ],
                        });
                    }

                    const edit: Record<string, any> = {};
                    if (opts.new_name) {
                        edit.name = opts.new_name;
                        changes = true;
                    }
                    if (opts.color) {
                        changes = true;
                        const c = opts.color.toLowerCase();
                        if (c === "random") edit.color = "Random";
                        else if (c === "remove") edit.color = null;
                        else if (/^#[0-9A-F]{6}$/i.test(c)) edit.color = c;
                        else {
                            return msg.reply({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("#ff3838")
                                        .setTitle("❌ Invalid Color")
                                        .setDescription(
                                            "Use hex (#RRGGBB), 'random', or 'remove'.",
                                        ),
                                ],
                            });
                        }
                    }
                    if (opts.hoist) {
                        edit.hoist = opts.hoist === "true";
                        changes = true;
                    }
                    if (opts.mentionable) {
                        edit.mentionable = opts.mentionable === "true";
                        changes = true;
                    }
                    if (opts.clear_icon === "true") {
                        edit.icon = null;
                        changes = true;
                    }

                    if (!changes) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ffcc00")
                                    .setDescription("⚠️ No changes specified."),
                            ],
                        });
                    }

                    edit.reason = `Role edited by ${msg.author.tag} via prefix`;
                    const updated = await role.edit(edit);
                    await msg.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(updated.color || "#57F287")
                                .setTitle("✅ Role Edited")
                                .setDescription(`Role ${updated} updated.`),
                        ],
                    });
                    Logger.info(
                        `User ${msg.author.id} edited role "${role.name}" via prefix in guild ${guild.id}`,
                    );

                    return;
                }

                // CHANNELS & CATEGORIES
                if (
                    ["textchannel", "voicechannel", "category"].includes(
                        entityType,
                    )
                ) {
                    if (
                        !perms.has(PermissionFlagsBits.ManageChannels) ||
                        !botMember.permissions.has(
                            PermissionFlagsBits.ManageChannels,
                        )
                    ) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        "❌ Missing Manage Channels permission.",
                                    ),
                            ],
                        });
                    }

                    const chan =
                        guild.channels.cache.get(targetId) ||
                        guild.channels.cache.find(
                            (c) =>
                                c.name.toLowerCase() === targetId.toLowerCase(),
                        );
                    if (!chan) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setDescription(
                                        `❌ Channel/Category "${targetId}" not found.`,
                                    ),
                            ],
                        });
                    }

                    const editOpts: GuildChannelEditOptions = {};
                    if (opts.new_name) {
                        editOpts.name = opts.new_name;
                        changes = true;
                    }

                    if (entityType === "textchannel") {
                        const tc = chan as TextChannel;
                        if (opts.topic) {
                            editOpts.topic =
                                opts.topic === "remove" ||
                                opts.topic === "clear"
                                    ? ""
                                    : opts.topic;
                            changes = true;
                        }
                        if (opts.category) {
                            if (opts.category.toLowerCase() === "remove") {
                                editOpts.parent = null;
                            } else {
                                const parent = guild.channels.cache.find(
                                    (c) =>
                                        c.type === ChannelType.GuildCategory &&
                                        c.name.toLowerCase() ===
                                            opts.category!.toLowerCase(),
                                ) as CategoryChannel | undefined;
                                if (!parent) {
                                    return msg.reply({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setColor("#ff3838")
                                                .setDescription(
                                                    `Parent category "${opts.category}" not found.`,
                                                ),
                                        ],
                                    });
                                }
                                editOpts.parent = parent.id;
                            }
                            changes = true;
                        }
                    }

                    if (entityType === "voicechannel") {
                        const vc = chan as VoiceChannel;
                        if (opts.category) {
                            if (opts.category.toLowerCase() === "remove") {
                                editOpts.parent = null;
                            } else {
                                const parent = guild.channels.cache.find(
                                    (c) =>
                                        c.type === ChannelType.GuildCategory &&
                                        c.name.toLowerCase() ===
                                            opts.category!.toLowerCase(),
                                ) as CategoryChannel | undefined;
                                if (!parent) {
                                    return msg.reply({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setColor("#ff3838")
                                                .setDescription(
                                                    `Parent category "${opts.category}" not found.`,
                                                ),
                                        ],
                                    });
                                }
                                editOpts.parent = parent.id;
                            }
                            changes = true;
                        }
                        if (opts.user_limit) {
                            editOpts.userLimit = parseInt(opts.user_limit, 10);
                            changes = true;
                        }
                        if (opts.bitrate) {
                            editOpts.bitrate =
                                parseInt(opts.bitrate, 10) * 1000;
                            changes = true;
                        }
                    }

                    if (entityType === "category" && !opts.new_name) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ffcc00")
                                    .setDescription(
                                        "⚠️ No new name specified for category.",
                                    ),
                            ],
                        });
                    }

                    if (!changes) {
                        return msg.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ffcc00")
                                    .setDescription("⚠️ No changes specified."),
                            ],
                        });
                    }

                    editOpts.reason = `Edited by ${msg.author.tag} via prefix`;
                    const updatedChan = await (
                        chan as GuildChannelResolvable
                    ).edit(editOpts as any);
                    await msg.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#57F287")
                                .setTitle(
                                    `✅ ${ChannelType[updatedChan.type]} Edited`,
                                )
                                .setDescription(`${updatedChan} updated.`),
                        ],
                    });
                    Logger.info(
                        `User ${msg.author.id} edited ${ChannelType[updatedChan.type].toLowerCase()} "${chan.name}" via prefix in guild ${guild.id}`,
                    );

                    return;
                }

                // Unknown entity type
                return msg.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "Invalid entity type. Use 'role', 'textchannel', 'voicechannel', or 'category'.",
                            ),
                    ],
                });
            } catch (err: any) {
                Logger.error(`Prefix edit failed in guild ${guild.id}:`, err);
                await msg.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setTitle("❌ Operation Failed")
                            .setDescription(
                                `An error occurred: ${err.message?.slice(0, 500) || "Unknown"}`,
                            ),
                    ],
                });
            }

            return;
        }

        // ----- Slash Command Handling -----
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            // Permission checks
            const needPerm =
                sub === "role"
                    ? PermissionFlagsBits.ManageRoles
                    : PermissionFlagsBits.ManageChannels;
            if (!perms.has(needPerm)) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `❌ You lack permission to ${sub === "role" ? "manage roles" : "manage channels"}.`,
                            ),
                    ],
                    ephemeral: true,
                });
            }
            if (!botMember.permissions.has(needPerm)) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                `❌ I lack permission to ${sub === "role" ? "manage roles" : "manage channels"} in this server.`,
                            ),
                    ],
                    ephemeral: true,
                });
            }

            // ROLE subcommand
            if (sub === "role") {
                const role = interaction.options.getRole("role", true) as Role;
                const newName = interaction.options.getString("new_name");
                const colorInput = interaction.options.getString("color");
                const hoist = interaction.options.getBoolean("hoist");
                const mentionable =
                    interaction.options.getBoolean("mentionable");
                const iconAttachment =
                    interaction.options.getAttachment("icon");
                const clearIcon =
                    interaction.options.getBoolean("clear_icon") ?? false;

                const editOptions: Record<string, any> = {};
                let iconDetail = "No icon changes.";
                let madeChange = false;

                if (newName) {
                    editOptions.name = newName;
                    madeChange = true;
                }
                if (hoist !== null) {
                    editOptions.hoist = hoist;
                    madeChange = true;
                }
                if (mentionable !== null) {
                    editOptions.mentionable = mentionable;
                    madeChange = true;
                }
                if (colorInput) {
                    madeChange = true;
                    const ci = colorInput.toLowerCase();
                    if (ci === "random") editOptions.color = "Random";
                    else if (["remove", "default", "0"].includes(ci))
                        editOptions.color = null;
                    else if (/^#[0-9A-F]{6}$/i.test(colorInput)) {
                        editOptions.color = colorInput as HexColorString;
                    } else {
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setTitle("❌ Invalid Color Format")
                                    .setDescription(
                                        "Provide a hex color (e.g., #FF0000), 'random', or 'remove'.",
                                    ),
                            ],
                            ephemeral: true,
                        });
                    }
                }

                if (clearIcon) {
                    editOptions.icon = null;
                    iconDetail = "Icon removed.";
                    madeChange = true;
                } else if (iconAttachment) {
                    madeChange = true;
                    if (!iconAttachment.contentType?.startsWith("image/")) {
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setTitle("❌ Invalid Icon File")
                                    .setDescription(
                                        "Please upload a valid image file (PNG, JPG, GIF) for the icon.",
                                    ),
                            ],
                            ephemeral: true,
                        });
                    }
                    try {
                        const resp = await axios.get(iconAttachment.url, {
                            responseType: "arraybuffer",
                        });
                        editOptions.icon = Buffer.from(resp.data);
                        iconDetail = `Icon updated (${iconAttachment.name}).`;
                    } catch (e: any) {
                        Logger.error("Failed to fetch icon:", e);
                        return interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#ff3838")
                                    .setTitle("❌ Icon Fetch Failed")
                                    .setDescription(
                                        "Could not download image for role icon.",
                                    ),
                            ],
                            ephemeral: true,
                        });
                    }
                }

                if (!madeChange) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ffcc00")
                                .setDescription(
                                    "⚠️ No changes were specified for the role.",
                                ),
                        ],
                        ephemeral: true,
                    });
                }

                editOptions.reason = `Role edited by ${interaction.user.tag}`;
                const updated = await role.edit(editOptions);

                const embed = new EmbedBuilder()
                    .setColor(
                        updated.hexColor === "#000000" &&
                            editOptions.color !== "Random" &&
                            editOptions.color !== null
                            ? "#99aab5"
                            : updated.color || "#57F287",
                    )
                    .setTitle("✅ Role Edited Successfully")
                    .setDescription(
                        `Role ${updated} (ID: \`${updated.id}\`) has been updated.`,
                    )
                    .addFields(
                        { name: "Name", value: updated.name, inline: true },
                        {
                            name: "Color",
                            value: `\`${updated.hexColor.toUpperCase()}\``,
                            inline: true,
                        },
                        {
                            name: "Hoisted",
                            value: updated.hoist ? "Yes" : "No",
                            inline: true,
                        },
                        {
                            name: "Mentionable",
                            value: updated.mentionable ? "Yes" : "No",
                            inline: true,
                        },
                    )
                    .addFields({ name: "Icon Status", value: iconDetail });

                await interaction.editReply({
                    embeds: [embed],
                    ephemeral: false,
                });
                Logger.info(
                    `User ${interaction.user.id} edited role "${role.name}" in guild ${guild.id}`,
                );
                return;
            }

            // TEXT CHANNEL subcommand
            if (sub === "textchannel") {
                const channel = interaction.options.getChannel(
                    "channel",
                    true,
                ) as TextChannel;
                const newName = interaction.options.getString("new_name");
                const topicInput = interaction.options.getString("topic");
                const categoryInput = interaction.options.getChannel(
                    "category",
                ) as CategoryChannel | null;

                const editOpts: GuildChannelEditOptions = {};
                let change = false;

                if (newName) {
                    editOpts.name = newName;
                    change = true;
                }
                if (topicInput !== null) {
                    editOpts.topic =
                        topicInput.toLowerCase() === "remove" ||
                        topicInput.toLowerCase() === "clear"
                            ? ""
                            : topicInput;
                    change = true;
                }
                if (
                    interaction.options.getChannel("category", false) !==
                    undefined
                ) {
                    editOpts.parent = categoryInput;
                    change = true;
                }

                if (!change) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ffcc00")
                                .setDescription(
                                    "⚠️ No changes were specified for the text channel.",
                                ),
                        ],
                        ephemeral: true,
                    });
                }

                editOpts.reason = `Text channel edited by ${interaction.user.tag}`;
                const updated = await channel.edit(editOpts);

                const embed = new EmbedBuilder()
                    .setColor("#57F287")
                    .setTitle("✅ Text Channel Edited")
                    .setDescription(`Text channel ${updated} has been updated.`)
                    .addFields({ name: "Name", value: updated.name })
                    .addFields({
                        name: "Topic",
                        value: updated.topic || "_Cleared_",
                    })
                    .addFields({
                        name: "Category",
                        value: updated.parent?.name || "_None_",
                    });

                await interaction.editReply({
                    embeds: [embed],
                    ephemeral: false,
                });
                Logger.info(
                    `User ${interaction.user.id} edited text channel "${channel.name}".`,
                );
                return;
            }

            // VOICE CHANNEL subcommand
            if (sub === "voicechannel") {
                const channel = interaction.options.getChannel(
                    "channel",
                    true,
                ) as VoiceChannel;
                const newName = interaction.options.getString("new_name");
                const categoryInput = interaction.options.getChannel(
                    "category",
                ) as CategoryChannel | null;
                const userLimit = interaction.options.getInteger("user_limit");
                const bitrate = interaction.options.getInteger("bitrate");

                const editOpts: GuildChannelEditOptions = {};
                let change = false;

                if (newName) {
                    editOpts.name = newName;
                    change = true;
                }
                if (
                    interaction.options.getChannel("category", false) !==
                    undefined
                ) {
                    editOpts.parent = categoryInput;
                    change = true;
                }
                if (userLimit !== null) {
                    editOpts.userLimit = userLimit;
                    change = true;
                }
                if (bitrate !== null) {
                    editOpts.bitrate = bitrate * 1000;
                    change = true;
                }

                if (!change) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ffcc00")
                                .setDescription(
                                    "⚠️ No changes were specified for the voice channel.",
                                ),
                        ],
                        ephemeral: true,
                    });
                }

                editOpts.reason = `Voice channel edited by ${interaction.user.tag}`;
                const updated = await channel.edit(editOpts);

                const embed = new EmbedBuilder()
                    .setColor("#57F287")
                    .setTitle("✅ Voice Channel Edited")
                    .setDescription(
                        `Voice channel ${updated} has been updated.`,
                    )
                    .addFields(
                        { name: "Name", value: updated.name },
                        {
                            name: "User Limit",
                            value:
                                updated.userLimit === 0
                                    ? "No limit"
                                    : `${updated.userLimit}`,
                        },
                    )
                    .addFields({
                        name: "Category",
                        value: updated.parent?.name || "_None_",
                    })
                    .addFields({
                        name: "Bitrate",
                        value: `${updated.bitrate! / 1000} Kbps`,
                    });

                await interaction.editReply({
                    embeds: [embed],
                    ephemeral: false,
                });
                Logger.info(
                    `User ${interaction.user.id} edited voice channel "${channel.name}".`,
                );
                return;
            }

            // CATEGORY subcommand
            if (sub === "category") {
                const channel = interaction.options.getChannel(
                    "channel",
                    true,
                ) as CategoryChannel;
                const newName = interaction.options.getString("new_name");
                if (!newName) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ffcc00")
                                .setDescription(
                                    "⚠️ No new name was specified for the category.",
                                ),
                        ],
                        ephemeral: true,
                    });
                }

                const editOpts: GuildChannelEditOptions = {
                    name: newName,
                    reason: `Category edited by ${interaction.user.tag}`,
                };
                const updated = await channel.edit(editOpts);

                const embed = new EmbedBuilder()
                    .setColor("#57F287")
                    .setTitle("✅ Category Edited")
                    .setDescription(
                        `Category "${updated.name}" has been updated.`,
                    );

                await interaction.editReply({
                    embeds: [embed],
                    ephemeral: false,
                });
                Logger.info(
                    `User ${interaction.user.id} edited category "${channel.name}".`,
                );
                return;
            }

            // Fallback
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ffcc00")
                        .setDescription(
                            `Subcommand '${sub}' is not yet implemented.`,
                        ),
                ],
                ephemeral: true,
            });
        } catch (err: any) {
            Logger.error(`Slash edit failed in guild ${guild.id}:`, err);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setTitle("❌ Operation Failed")
                .setDescription(
                    `Error: \`${err.message?.slice(0, 1000) || "Unknown"}\``,
                );
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            }
        }
    },
};
