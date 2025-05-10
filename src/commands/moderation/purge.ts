import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    PermissionsBitField,
    TextChannel,
    User,
    Collection,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Deletes a specified number of messages from a channel.")
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("Number of messages to delete (1-100)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100),
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("Only delete messages from this user")
                .setRequired(false),
        )
        .setDMPermission(false), // Guild only
    prefix: {
        aliases: ["purge", "clear", "prune"],
        usage: "<amount> [user_mention_or_id]",
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let amount: number;
        let targetUser: User | null = null;
        let channel: TextChannel;
        let memberPermissions: Readonly<PermissionsBitField> | null;
        let guildId: string | null;
        let authorId: string;

        try {
            if (isPrefix) {
                const msg = interaction as Message;
                if (!msg.guild || !(msg.channel instanceof TextChannel)) {
                    return msg.reply("This command can only be used in server text channels.");
                }
                channel = msg.channel;
                guildId = msg.guild.id;
                authorId = msg.author.id;
                memberPermissions = msg.member?.permissions ?? null;

                const prefixStr = process.env.PREFIX || "jam!";
                const args = msg.content.slice(prefixStr.length).trim().split(/ +/);
                args.shift(); // Remove command name

                if (!args[0] || isNaN(parseInt(args[0]))) {
                    // Attempt to delete the invalid command message quickly
                    msg.delete().catch(Logger.error);
                    return msg.reply(
                        `❌ Please provide a valid number of messages to delete. Usage: \`${prefixStr}purge <amount> [user]\``,
                    ).then(reply => setTimeout(() => reply.delete().catch(Logger.error), 5000));
                }
                amount = parseInt(args[0]);

                if (args[1]) {
                    const userIdMatch = args[1].match(/^<@!?(\d+)>$/);
                    const userId = userIdMatch ? userIdMatch[1] : args[1];
                    try {
                        targetUser = await msg.client.users.fetch(userId);
                    } catch {
                         msg.delete().catch(Logger.error);
                        return msg.reply("❌ Could not find the specified user.").then(reply => setTimeout(() => reply.delete().catch(Logger.error), 5000));
                    }
                }
                // Attempt to delete the user's command message
                // We do this after parsing args in case of early exit from invalid args
                await msg.delete().catch(err => Logger.warn("Could not delete purge command message:", err));

            } else {
                const slash = interaction as ChatInputCommandInteraction;
                if (!slash.guild || !(slash.channel instanceof TextChannel)) {
                     // This should ideally be caught by setDMPermission(false) and channel type checks
                    return slash.reply({
                        content: "This command can only be used in server text channels.",
                        ephemeral: true,
                    });
                }
                channel = slash.channel;
                guildId = slash.guild.id;
                authorId = slash.user.id;
                memberPermissions = slash.member?.permissions as PermissionsBitField;
                amount = slash.options.getInteger("amount", true);
                targetUser = slash.options.getUser("user");
            }

            if (!memberPermissions) {
                const errMsg = "Could not verify your permissions.";
                Logger.warn(`Could not get memberPermissions for user ${authorId} in guild ${guildId}`);
                if (isPrefix) return (interaction as Message).reply(errMsg);
                return (interaction as ChatInputCommandInteraction).reply({ content: errMsg, ephemeral: true });
            }

            if (!memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
                const errMsg = "❌ You do not have permission to manage messages in this channel.";
                if (isPrefix) return (interaction as Message).reply(errMsg);
                return (interaction as ChatInputCommandInteraction).reply({ content: errMsg, ephemeral: true });
            }

            const botMember = await channel.guild.members.fetch(interaction.client.user!.id);
            if (!botMember.permissionsIn(channel).has(PermissionsBitField.Flags.ManageMessages)) {
                const errMsg = "❌ I do not have permission to manage messages in this channel.";
                Logger.warn(`Missing ManageMessages permission in channel ${channel.id} of guild ${guildId}`);
                if (isPrefix) return (interaction as Message).reply(errMsg);
                return (interaction as ChatInputCommandInteraction).reply({ content: errMsg, ephemeral: true });
            }

            if (amount < 1 || amount > 100) {
                const errMsg = "❌ You can only purge between 1 and 100 messages at a time.";
                if (isPrefix) return (interaction as Message).reply(errMsg);
                return (interaction as ChatInputCommandInteraction).reply({ content: errMsg, ephemeral: true });
            }

            if (!isPrefix && !(interaction as ChatInputCommandInteraction).deferred) {
                await (interaction as ChatInputCommandInteraction).deferReply(); // Public deferral
            }

            let messagesToDelete: Collection<string, Message>;
            let fetchedMessages: Collection<string, Message>;

            if (isPrefix) {
                // For prefix commands, fetch messages *before* the command message ID.
                // The command message itself is already deleted (or attempted to be).
                fetchedMessages = await channel.messages.fetch({ limit: amount, before: (interaction as Message).id });
            } else {
                // For slash commands, fetch the latest 'amount' messages.
                fetchedMessages = await channel.messages.fetch({ limit: amount });
            }

            if (targetUser) {
                messagesToDelete = fetchedMessages.filter(m => m.author.id === targetUser!.id);
            } else {
                messagesToDelete = fetchedMessages;
            }
            
            if (messagesToDelete.size === 0) {
                const replyMsg = targetUser 
                    ? `No messages found from ${targetUser.username} in the last ${amount} messages.`
                    : "No messages found to delete.";
                if (isPrefix) return (interaction as Message).reply(replyMsg);
                return (interaction as ChatInputCommandInteraction).editReply(replyMsg);
            }

            // Filter out messages older than 14 days as they cannot be bulk deleted
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const youngMessages = messagesToDelete.filter(m => m.createdTimestamp > twoWeeksAgo);
            const oldMessagesCount = messagesToDelete.size - youngMessages.size;

            let replyMessage = "";

            if (youngMessages.size > 0) {
                const deleted = await channel.bulkDelete(youngMessages, true);
                replyMessage = `✅ Successfully deleted ${deleted.size} message(s)${targetUser ? ` from ${targetUser.username}` : ""}.`;
                Logger.info(`User ${authorId} purged ${deleted.size} messages in channel ${channel.id}, guild ${guildId}${targetUser ? ` from user ${targetUser.id}` : ""}`);
            } else {
                replyMessage = "No messages newer than 14 days were found to delete.";
                if (targetUser) {
                     replyMessage = `No messages found from ${targetUser.username} newer than 14 days in the last ${amount} messages.`;
                }
            }
            
            if (oldMessagesCount > 0) {
                replyMessage += `\n⚠️ ${oldMessagesCount} message(s) were older than 14 days and could not be bulk deleted.`;
            }


            if (isPrefix) {
                const successReplyText = "✅ Purged!";
                const sentReply = await channel.send(successReplyText); // Send to channel, not as a reply to a deleted message
                setTimeout(() => sentReply.delete().catch(Logger.error), 2000); // Delete reply after 2 seconds
            } else {
                // Slash command success message (public, then deleted)
                await (interaction as ChatInputCommandInteraction).editReply(replyMessage); // replyMessage still contains detailed info for slash
                setTimeout(() => (interaction as ChatInputCommandInteraction).deleteReply().catch(Logger.error), 7000); 
            }

        } catch (err: any) {
            Logger.error(`Purge command error in guild ${guildId}, channel ${(channel as TextChannel)?.id}:`, err);
            const errMsg = "😢 Oops, something went wrong while trying to purge messages.";
            if (isPrefix) {
                 try {
                    const sentErrorReply = await (interaction as Message).reply(errMsg);
                    setTimeout(() => sentErrorReply.delete().catch(Logger.error), 7000);
                 } catch {}
            } else {
                const slashInteraction = interaction as ChatInputCommandInteraction;
                if (slashInteraction.replied || slashInteraction.deferred) {
                    await slashInteraction.editReply(errMsg).catch(Logger.error);
                } else {
                    // This case should ideally not be reached if we defer properly
                    await slashInteraction.reply({ content: errMsg, ephemeral: true }).catch(Logger.error);
                }
            }
        }
    },
};
