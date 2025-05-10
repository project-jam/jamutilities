import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember,
    PermissionsBitField,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("changenickname")
        .setDescription("Changes your nickname on this server.")
        .addStringOption((option) =>
            option
                .setName("new_nickname")
                .setDescription("Your new nickname. Leave blank to reset.")
                .setRequired(false), // Set to false to allow resetting
        )
        .setDMPermission(false), // Nicknames are server-specific
    prefix: {
        aliases: ["nick", "nickname", "changename", "setnick"],
        usage: "<new_nickname> or leave blank to reset your nickname",
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let newNickname: string | null = null;
        let member: GuildMember | undefined | null = null;
        let userDisplayName: string = "";

        try {
            if (isPrefix) {
                const msg = interaction as Message;
                if (!msg.guild) {
                    return msg.reply("This command can only be used in a server.");
                }
                member = msg.member;
                userDisplayName = msg.author.username;

                const prefixStr = process.env.PREFIX || "jam!";
                const args = msg.content.slice(prefixStr.length).trim().split(/ +/);
                const commandName = args.shift()?.toLowerCase();

                if (!commandName || !this.prefix!.aliases!.includes(commandName)) {
                    return; // Should not happen if called correctly
                }
                newNickname = args.join(" ") || null; // Allow empty string to signify reset
            } else {
                const slash = interaction as ChatInputCommandInteraction;
                if (!slash.guild) {
                    // Should be blocked by setDMPermission(false), but good to check
                    return slash.reply({
                        content: "This command can only be used in a server.",
                        ephemeral: true,
                    });
                }
                member = slash.member as GuildMember;
                userDisplayName = slash.user.username;
                newNickname = slash.options.getString("new_nickname");
            }

            if (!member) {
                const errorMsg = "Could not find server member information.";
                Logger.error(errorMsg);
                if (isPrefix) {
                    return (interaction as Message).reply(errorMsg);
                } else {
                    return (interaction as ChatInputCommandInteraction).reply({
                        content: errorMsg,
                        ephemeral: true,
                    });
                }
            }

            // Check if trying to change owner's nickname (even themselves)
            if (member.id === member.guild.ownerId) {
                const errorMsg = "❌ I cannot change the server owner's nickname.";
                if (isPrefix) {
                    return (interaction as Message).reply(errorMsg);
                } else {
                    return (interaction as ChatInputCommandInteraction).reply({
                        content: errorMsg,
                        ephemeral: true,
                    });
                }
            }

            // Check if the user has permission to change their own nickname
            if (!member.permissions.has(PermissionsBitField.Flags.ChangeNickname)) {
                const errorMsg = "❌ You don't have permission to change your own nickname in this server.";
                if (isPrefix) {
                    return (interaction as Message).reply(errorMsg);
                } else {
                    return (interaction as ChatInputCommandInteraction).reply({
                        content: errorMsg,
                        ephemeral: true,
                    });
                }
            }

            // Check bot permissions
            const botMember = await member.guild.members.fetch(interaction.client.user!.id);
            if (!botMember.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
                const errorMsg = "❌ I don't have permission to manage nicknames in this server.";
                Logger.warn(`Missing ManageNicknames permission in guild ${member.guild.id}`);
                if (isPrefix) {
                    return (interaction as Message).reply(errorMsg);
                } else {
                    return (interaction as ChatInputCommandInteraction).reply({
                        content: errorMsg,
                        ephemeral: true,
                    });
                }
            }

            // Check if member's highest role is lower than bot's highest role
            if (member.roles.highest.position >= botMember.roles.highest.position) {
                 const errorMsg = "❌ I cannot change the nickname of someone with a role higher than or equal to mine.";
                 if (isPrefix) {
                    return (interaction as Message).reply(errorMsg);
                } else {
                    return (interaction as ChatInputCommandInteraction).reply({
                        content: errorMsg,
                        ephemeral: true,
                    });
                }
            }


            const oldNickname = member.displayName;
            await member.setNickname(newNickname);
            const successMsg = newNickname
                ? `✅ Successfully changed ${userDisplayName}'s nickname from \`${oldNickname}\` to \`${newNickname}\`.`
                : `✅ Successfully reset ${userDisplayName}'s nickname from \`${oldNickname}\` to their username.`;
            
            Logger.info(`Changed nickname for ${userDisplayName} (ID: ${member.id}) in guild ${member.guild.id} from "${oldNickname}" to "${newNickname || member.user.username}"`);

            if (isPrefix) {
                await (interaction as Message).reply(successMsg);
            } else {
                await (interaction as ChatInputCommandInteraction).reply({
                    content: successMsg,
                    ephemeral: false, // Make it visible
                });
            }

        } catch (err: any) {
            Logger.error("Change nickname error:", err);
            let errMsg = "😢 Oops, something went wrong while trying to change the nickname.";
            if (err.message?.includes("Invalid Form Body") && err.message?.includes("NICKNAME_INVALID")) {
                errMsg = "❌ That nickname is invalid. It might be too long (max 32 characters) or contain invalid characters.";
            } else if (err.message?.includes("Missing Permissions")) {
                errMsg = "❌ It seems I'm still missing permissions, or I'm trying to change the nickname of someone I can't.";
            }


            if (isPrefix) {
                await (interaction as Message).reply(errMsg);
            } else {
                const slashInteraction = interaction as ChatInputCommandInteraction;
                if (slashInteraction.replied || slashInteraction.deferred) {
                    await slashInteraction.editReply(errMsg);
                } else {
                    await slashInteraction.reply({ content: errMsg, ephemeral: true });
                }
            }
        }
    },
};
