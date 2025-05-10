import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
    ChatInputCommandInteraction,
    CategoryChannel,
    GuildChannelCreateOptions,
    Attachment,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import axios from 'axios'; // For fetching image buffer

export const command: Command = {
    prefix: {
        aliases: ["create", "mk", "new"],
        usage: "<category|textchannel|voicechannel|role> <name> [options...]", // General usage, specific below
    },
    data: new SlashCommandBuilder()
        .setName("create")
        .setDescription("Creates server entities like channels, categories, or roles.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.ManageRoles)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("category")
                .setDescription("Creates a new channel category.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("The name for the new category")
                        .setRequired(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("textchannel")
                .setDescription("Creates a new text channel.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("The name for the new text channel")
                        .setRequired(true),
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription("The category to create this channel in")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName("topic")
                        .setDescription("The topic for the new text channel")
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("voicechannel")
                .setDescription("Creates a new voice channel.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("The name for the new voice channel")
                        .setRequired(true),
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription("The category to create this channel in")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName("user_limit")
                        .setDescription("The user limit for the voice channel (0 for no limit)")
                        .setMinValue(0)
                        .setMaxValue(99)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName("bitrate")
                        .setDescription("The bitrate for the voice channel in Kbps (e.g., 64)")
                        .setMinValue(8)
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("role")
                .setDescription("Creates a new role.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("The name for the new role")
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("color")
                        .setDescription("Hex color for the role (e.g., #FF0000 or 'random')")
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName("hoist")
                        .setDescription("Whether the role should be displayed separately (default: false)")
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName("mentionable")
                        .setDescription("Whether the role should be mentionable (default: false)")
                        .setRequired(false),
                )
                .addAttachmentOption((option) => // Changed to AttachmentOption
                    option
                        .setName("icon")
                        .setDescription("Image file for the role icon. Server boost Level 2+ required.")
                        .setRequired(false),
                ),
        ),
    async execute(interaction: ChatInputCommandInteraction | Message, isPrefix = false) { // Added isPrefix
        const guild = isPrefix ? (interaction as Message).guild : interaction.guild;
        if (!guild) {
            const errorEmbed = new EmbedBuilder().setColor("#ff3838").setDescription("This command can only be used in a server.");
            if (isPrefix) return (interaction as Message).reply({ embeds: [errorEmbed] });
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const botMember = await guild.members.fetch(interaction.client.user!.id);
        const member = isPrefix ? (interaction as Message).member : interaction.member;
        const memberPermissions = member?.permissions as PermissionFlagsBits;

        if (isPrefix) {
            const msg = interaction as Message;
            const prefixStr = process.env.PREFIX || "jam!"; // Ensure you have a way to get the prefix
            const args = msg.content.slice(prefixStr.length).trim().split(/ +/);
            const cmdName = args.shift()?.toLowerCase(); // e.g., create

            if (!this.prefix!.aliases!.includes(cmdName!)) return; // Should not happen if handler is correct

            const subCommandName = args.shift()?.toLowerCase();
            let entityName = "";
            let parentCategoryName: string | undefined = undefined;
            let colorInput: string | undefined = undefined;
            let topicInput: string | undefined = undefined;

            // Basic arg parsing for prefix - can be complex
            if (args.length > 0) {
                let nameParts: string[] = [];
                for (let i = 0; i < args.length; i++) {
                    const arg = args[i].toLowerCase();
                    if (arg.startsWith("under:")) {
                        parentCategoryName = args[i].substring("under:".length);
                        if (args[i+1] && !args[i+1].startsWith("color:") && !args[i+1].startsWith("topic:")) {
                            // if category name has spaces and wasn't quoted, this is tricky
                            // For simplicity, assume category name is one word or quoted if it has spaces for prefix.
                            // This part of parsing can be very complex for many options.
                        }
                    } else if (arg.startsWith("color:")) {
                        colorInput = args[i].substring("color:".length);
                    } else if (arg.startsWith("topic:")) {
                        topicInput = args.slice(i).join(" ").substring("topic:".length);
                        break; // Assume topic is the last set of args
                    } else {
                        nameParts.push(args[i]);
                    }
                }
                entityName = nameParts.join(" ");
            }

            if (!subCommandName || !entityName) {
                return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription(`Usage: ${prefixStr}${cmdName} <category|textchannel|voicechannel|role> <name> [options...]`)] });
            }

            try {
                // Prefix permission checks (user)
                if (subCommandName === "role") {
                    if (!memberPermissions || !memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
                        return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ You do not have permission to manage roles.")] });
                    }
                } else { // category, textchannel, voicechannel
                    if (!memberPermissions || !memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
                        return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ You do not have permission to manage channels.")] });
                    }
                }
                 // Bot permission checks already done for slash, repeat for prefix
                if ((subCommandName === "category" || subCommandName === "textchannel" || subCommandName === "voicechannel") && !botMember.permissions.has(PermissionFlagsBits.ManageChannels)){
                    return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ I don't have permission to manage channels.")] });
                } else if (subCommandName === "role" && !botMember.permissions.has(PermissionFlagsBits.ManageRoles)){
                     return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ I don't have permission to manage roles.")] });
                }


                if (subCommandName === "category") {
                    const createdCategory = await guild.channels.create({
                        name: entityName,
                        type: ChannelType.GuildCategory,
                        reason: `Created by ${msg.author.tag} via prefix command`,
                    });
                    const successEmbed = new EmbedBuilder().setColor("#57F287").setTitle("✅ Category Created").setDescription(`Successfully created category: **${createdCategory.name}**`);
                    await msg.reply({ embeds: [successEmbed] });
                    Logger.info(`User ${msg.author.id} created category "${entityName}" via prefix in guild ${guild.id}`);
                
                } else if (subCommandName === "textchannel") {
                    const options: GuildChannelCreateOptions = { name: entityName, type: ChannelType.GuildText, reason: `Created by ${msg.author.tag} via prefix command` };
                    if (parentCategoryName) {
                        const parent = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === parentCategoryName.toLowerCase()) as CategoryChannel | undefined;
                        if (parent) options.parent = parent.id;
                        else return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription(`❌ Category "${parentCategoryName}" not found.`)] });
                    }
                    if (topicInput) options.topic = topicInput;

                    const createdChannel = await guild.channels.create(options);
                    const successEmbed = new EmbedBuilder().setColor("#57F287").setTitle("✅ Text Channel Created").setDescription(`Successfully created text channel: ${createdChannel}`);
                    await msg.reply({ embeds: [successEmbed] });
                    Logger.info(`User ${msg.author.id} created text channel "${entityName}" via prefix in guild ${guild.id}`);

                } else if (subCommandName === "voicechannel") {
                    const options: GuildChannelCreateOptions = { name: entityName, type: ChannelType.GuildVoice, reason: `Created by ${msg.author.tag} via prefix command` };
                     if (parentCategoryName) {
                        const parent = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === parentCategoryName.toLowerCase()) as CategoryChannel | undefined;
                        if (parent) options.parent = parent.id;
                        else return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription(`❌ Category "${parentCategoryName}" not found.`)] });
                    }
                    // userLimit and bitrate are harder for prefix, keeping it simple for now
                    const createdChannel = await guild.channels.create(options);
                    const successEmbed = new EmbedBuilder().setColor("#57F287").setTitle("✅ Voice Channel Created").setDescription(`Successfully created voice channel: ${createdChannel}`);
                    await msg.reply({ embeds: [successEmbed] });
                    Logger.info(`User ${msg.author.id} created voice channel "${entityName}" via prefix in guild ${guild.id}`);

                } else if (subCommandName === "role") {
                    const roleOptions: any = { name: entityName, reason: `Created by ${msg.author.tag} via prefix command` }; 
                    if (colorInput) {
                        if (colorInput.toLowerCase() === 'random') roleOptions.color = 'Random';
                        else if (/^#[0-9A-F]{6}$/i.test(colorInput)) roleOptions.color = colorInput as import('discord.js').HexColorString;
                        else return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ Invalid color format. Use #RRGGBB or 'random'.")] });
                    }
                    // Hoist, mentionable, icon are not supported for this simplified prefix version.

                    const createdRole = await guild.roles.create(roleOptions);
                    const successEmbed = new EmbedBuilder().setColor(createdRole.color || "#57F287").setTitle("✅ Role Created").setDescription(`Successfully created role: ${createdRole}`);
                    await msg.reply({ embeds: [successEmbed] });
                    Logger.info(`User ${msg.author.id} created role "${entityName}" via prefix in guild ${guild.id}`);

                } else {
                    return msg.reply({ embeds: [new EmbedBuilder().setColor("#ff3838").setDescription(`Invalid subcommand. Usage: ${prefixStr}${cmdName} <category|textchannel|voicechannel|role> <name> ...`)] });
                }
            } catch (error: any) {
                Logger.error(`Prefix Create command (${subCommandName}) failed for guild ${guild.id} by user ${msg.author.id}:`, error);
                const errorEmbed = new EmbedBuilder().setColor("#ff3838").setTitle("❌ Operation Failed").setDescription(`An error occurred: ${error.message}`);
                await msg.reply({ embeds: [errorEmbed] });
            }
            return; // End of prefix handling
        }

        // --- Existing Slash Command Logic --- 
        const subcommandSlash = interaction.options.getSubcommand(); // Renamed to avoid conflict

        try {
            await interaction.deferReply({ ephemeral: true });

            // Slash command permission checks (bot only, user perms are via setDefaultMemberPermissions)
            if (subcommandSlash === "category" || subcommandSlash === "textchannel" || subcommandSlash === "voicechannel") {
                if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return interaction.editReply({
                        embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ I don't have permission to manage channels in this server.")],
                        ephemeral: true,
                    });
                }
            } else if (subcommandSlash === "role") {
                // User permission for ManageRoles is checked by discord for slash commands via setDefaultMemberPermissions
                // We still need to check if the slash command *invoker* has the perm, as setDefaultMemberPermissions only gates the command itself, not specific subcommands.
                // This check is actually slightly redundant for slash if setDefaultMemberPermissions includes ManageRoles, but good for clarity.
                if (!memberPermissions || !memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
                     return interaction.editReply({
                        embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ You do not have permission to manage roles (Slash check). This shouldn't typically happen if default perms are set right.")],
                        ephemeral: true,
                    });
                }
                if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                    return interaction.editReply({
                        embeds: [new EmbedBuilder().setColor("#ff3838").setDescription("❌ I don't have permission to manage roles in this server.")],
                        ephemeral: true,
                    });
                }
            }

            if (subcommandSlash === "category") {
                const name = interaction.options.getString("name", true);
                const createdCategory = await interaction.guild.channels.create({
                    name: name,
                    type: ChannelType.GuildCategory,
                    reason: `Created by ${interaction.user.tag} via /create command`,
                });
                const successEmbed = new EmbedBuilder()
                    .setColor("#57F287")
                    .setTitle("✅ Category Created")
                    .setDescription(`Successfully created category: **${createdCategory.name}** (ID: \`${createdCategory.id}\`)`);
                await interaction.editReply({ embeds: [successEmbed], ephemeral: false });
                Logger.info(`User ${interaction.user.id} created category "${name}" in guild ${interaction.guild.id}`);

            } else if (subcommand === "textchannel") {
                const name = interaction.options.getString("name", true);
                const category = interaction.options.getChannel("category") as CategoryChannel | null;
                const topic = interaction.options.getString("topic");

                const options: GuildChannelCreateOptions = {
                    name: name,
                    type: ChannelType.GuildText,
                    reason: `Created by ${interaction.user.tag} via /create command`,
                };
                if (category) options.parent = category.id;
                if (topic) options.topic = topic;

                const createdChannel = await interaction.guild.channels.create(options);
                const successEmbed = new EmbedBuilder()
                    .setColor("#57F287")
                    .setTitle("✅ Text Channel Created")
                    .setDescription(`Successfully created text channel: ${createdChannel} (ID: \`${createdChannel.id}\`)`);
                if (category) successEmbed.addFields({ name: "In Category", value: category.name });
                await interaction.editReply({ embeds: [successEmbed], ephemeral: false });
                Logger.info(`User ${interaction.user.id} created text channel "${name}" in guild ${interaction.guild.id}`);
            
            } else if (subcommand === "voicechannel") {
                const name = interaction.options.getString("name", true);
                const category = interaction.options.getChannel("category") as CategoryChannel | null;
                const userLimit = interaction.options.getInteger("user_limit");
                const bitrateOption = interaction.options.getInteger("bitrate");

                const options: GuildChannelCreateOptions = {
                    name: name,
                    type: ChannelType.GuildVoice,
                    reason: `Created by ${interaction.user.tag} via /create command`,
                };
                if (category) options.parent = category.id;
                if (userLimit !== null) options.userLimit = userLimit;
                if (bitrateOption !== null) options.bitrate = bitrateOption * 1000;

                const createdChannel = await interaction.guild.channels.create(options);
                const successEmbed = new EmbedBuilder()
                    .setColor("#57F287")
                    .setTitle("✅ Voice Channel Created")
                    .setDescription(`Successfully created voice channel: ${createdChannel} (ID: \`${createdChannel.id}\`)`);
                if (category) successEmbed.addFields({ name: "In Category", value: category.name });
                if (userLimit !== null) successEmbed.addFields({ name: "User Limit", value: userLimit === 0 ? "No limit" : userLimit.toString() });
                if (bitrateOption !== null) successEmbed.addFields({ name: "Bitrate", value: `${bitrateOption} Kbps` });
                await interaction.editReply({ embeds: [successEmbed], ephemeral: false });
                Logger.info(`User ${interaction.user.id} created voice channel "${name}" in guild ${interaction.guild.id}`);
            
            } else if (subcommand === "role") {
                const name = interaction.options.getString("name", true);
                let colorInput = interaction.options.getString("color");
                const hoist = interaction.options.getBoolean("hoist") ?? false;
                const mentionable = interaction.options.getBoolean("mentionable") ?? false;
                const iconAttachment = interaction.options.getAttachment("icon"); // Get Attachment

                let roleIcon: Buffer | null = null;
                let iconFeedback = "Not provided";

                if (iconAttachment) {
                    if (!iconAttachment.contentType || !iconAttachment.contentType.startsWith("image/")) {
                        return interaction.editReply({
                            embeds: [new EmbedBuilder().setColor("#ff3838").setTitle("❌ Invalid Icon File").setDescription("Please upload a valid image file (PNG, JPG, GIF) for the role icon.")],
                            ephemeral: true
                        });
                    }
                    try {
                        const response = await axios.get(iconAttachment.url, { responseType: 'arraybuffer' });
                        roleIcon = Buffer.from(response.data);
                        iconFeedback = `Uploaded: ${iconAttachment.name}`;
                    } catch (fetchError: any) {
                        Logger.error("Failed to fetch role icon attachment:", fetchError);
                        return interaction.editReply({
                            embeds: [new EmbedBuilder().setColor("#ff3838").setTitle("❌ Icon Fetch Failed").setDescription("Could not download the provided image for the role icon. Please try again or use a different image.")],
                            ephemeral: true
                        });
                    }
                }

                let roleOptions: { 
                    name: string;
                    color?: import('discord.js').ColorResolvable;
                    hoist: boolean;
                    mentionable: boolean;
                    icon?: Buffer | null; 
                    permissions?: import('discord.js').PermissionsBitField;
                    reason?: string;
                } = {
                    name: name,
                    hoist: hoist,
                    mentionable: mentionable,
                    icon: roleIcon,
                    permissions: [], 
                    reason: `Role created by ${interaction.user.tag} (${interaction.user.id}) via /create command`,
                };

                if (colorInput) {
                    if (colorInput.toLowerCase() === 'random') {
                        roleOptions.color = 'Random';
                    } else if (/^#[0-9A-F]{6}$/i.test(colorInput)) {
                        roleOptions.color = colorInput as import('discord.js').HexColorString;
                    } else {
                        return interaction.editReply({
                            embeds: [new EmbedBuilder()
                                .setColor("#ff3838")
                                .setTitle("❌ Invalid Color Format")
                                .setDescription("Please provide a valid hex color (e.g., #FF0000) or type 'random'.")],
                            ephemeral: true
                        });
                    }
                }

                const createdRole = await interaction.guild.roles.create(roleOptions);

                const successEmbed = new EmbedBuilder()
                    .setColor(createdRole.hexColor === "#000000" && roleOptions.color !== 'Random' ? "#99aab5" : createdRole.color || "#57F287")
                    .setTitle("✅ Role Created")
                    .setDescription(`Successfully created role: ${createdRole} (ID: \`${createdRole.id}\`)`)
                    .addFields(
                        { name: "Name", value: createdRole.name, inline: true },
                        { name: "Color", value: `\`${createdRole.hexColor.toUpperCase()}\``, inline: true },
                        { name: "Hoisted", value: createdRole.hoist ? "Yes" : "No", inline: true },
                        { name: "Mentionable", value: createdRole.mentionable ? "Yes" : "No", inline: true }
                    );
                if (iconAttachment) successEmbed.addFields({ name: "Icon", value: `${iconFeedback} (Visibility depends on server boost level)` });
                
                await interaction.editReply({ embeds: [successEmbed], ephemeral: false });
                Logger.info(`User ${interaction.user.id} created role "${name}" (ID: ${createdRole.id}) in guild ${interaction.guild.id}`);
            }

        } catch (error: any) {
            Logger.error(`Create command (${subcommand}) failed for guild ${interaction.guild?.id} by user ${interaction.user.id}:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setTitle("❌ Operation Failed")
                .setDescription(`An error occurred while trying to create the ${subcommand}. Please check my permissions and your input.\nError: \`${error.message?.substring(0, 1000) || 'Unknown error'}\``);
            
            if (interaction.replied || interaction.deferred) {
                 await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};