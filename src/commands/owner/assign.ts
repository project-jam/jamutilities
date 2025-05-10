import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    EmbedBuilder,
    Message,
    User,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import * as fs from "fs";
import * as path from "path";

// Path to the root .env file
const projectRoot = path.join(__dirname, "..", "..", "..");
const envPath = path.join(projectRoot, ".env");

// Helper to update .env file
async function updateEnvFile(key: string, value: string): Promise<void> {
    try {
        const envFileExists = fs.existsSync(envPath);
        const lines = envFileExists
            ? fs.readFileSync(envPath, "utf8").split("\n")
            : [];

        let keyUpdated = false;
        const newFileLines = lines.map((line) => {
            if (line.startsWith(`${key}=`)) {
                keyUpdated = true;
                return `${key}=${value}`;
            }
            return line;
        });

        if (!keyUpdated) {
            newFileLines.push(`${key}=${value}`);
        }

        const content = newFileLines
            .filter((l) => typeof l === "string")
            .join("\n");
        fs.writeFileSync(envPath, content ? content + "\n" : "");

        Logger.info(`Updated ${key} in .env file: ${envPath}`);
    } catch (error) {
        const e = error as Error;
        Logger.error(
            `Failed to update .env file for key ${key}: ${e.message}`,
            e,
        );
        throw new Error(`Failed to persist ${key} to .env file: ${e.message}.`);
    }
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("assign")
        .setDescription(
            "Assigns a user to the team or removes them (persists in .env).",
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // This is a default, runtime check is more critical
        .addSubcommand((subcommand) =>
            subcommand
                .setName("add")
                .setDescription("Adds a user to the team.")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("The user to add.")
                        .setRequired(true),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Removes a user from the team.")
                .addUserOption((option) =>
                    option
                        .setName("user")
                        .setDescription("The user to remove.")
                        .setRequired(true),
                ),
        ),
    prefix: {
        aliases: [],
        usage: "assign <add|remove> <userID_or_mention>",
    },
    integration_types: [0, 1],
    contexts: [0, 1, 2],

    async execute(
        interactionOrMessage: ChatInputCommandInteraction | Message,
        isPrefix = false,
        argsFromPrefix?: string[],
    ) {
        const ownerId = process.env.OWNER_ID;
        const executorId = isPrefix
            ? (interactionOrMessage as Message).author.id
            : (interactionOrMessage as ChatInputCommandInteraction).user.id;

        // Reverted: Only OWNER_ID can use this command
        if (executorId !== ownerId) {
            const replyContent =
                "You do not have permission to use this command.";
            if (isPrefix) {
                await (interactionOrMessage as Message).reply(replyContent);
            } else {
                await (
                    interactionOrMessage as ChatInputCommandInteraction
                ).reply({ content: replyContent, ephemeral: true });
            }
            return;
        }

        let action: string;
        let targetUser: User | undefined;
        const prefixVal = process.env.PREFIX || "jam!";

        if (isPrefix) {
            const message = interactionOrMessage as Message;
            const args =
                argsFromPrefix ||
                message.content
                    .slice(prefixVal.length)
                    .trim()
                    .split(/ +/)
                    .slice(1);

            action = args[0]?.toLowerCase();
            const userIdentifier = args[1];

            if (!action || (action !== "add" && action !== "remove")) {
                await message.reply(
                    `Invalid action. Usage: \`${prefixVal}assign <add|remove> <userID_or_mention>\``,
                );
                return;
            }
            if (!userIdentifier) {
                await message.reply(
                    `Please specify a user to ${action}. Usage: \`${prefixVal}assign ${action} <userID_or_mention>\``,
                );
                return;
            }

            const userIdToAssign = userIdentifier.replace(/[<@!>]/g, "");
            try {
                targetUser = await message.client.users.fetch(userIdToAssign);
            } catch {
                await message.reply(
                    "Could not find that user. Please provide a valid user ID or mention.",
                );
                return;
            }
        } else {
            const interaction =
                interactionOrMessage as ChatInputCommandInteraction;
            action = interaction.options.getSubcommand();
            targetUser = interaction.options.getUser("user", true);
        }

        if (!targetUser) {
            Logger.error("Target user was not resolved in assign command.");
            const replyContent = "Could not determine the target user.";
            if (isPrefix) {
                await (interactionOrMessage as Message).reply(replyContent);
            } else {
                await (
                    interactionOrMessage as ChatInputCommandInteraction
                ).reply({ content: replyContent, ephemeral: true });
            }
            return;
        }

        const targetUserId = targetUser.id;

        // This logic correctly prevents adding/removing the owner from the TEAM_ID list
        if (targetUserId === ownerId) {
            const replyContent =
                action === "add"
                    ? "The owner is implicitly part of the team and cannot be explicitly added or managed by this command."
                    : "You cannot remove the owner from the team using this command. The owner has inherent privileges.";
            if (isPrefix) {
                await (interactionOrMessage as Message).reply(replyContent);
            } else {
                await (
                    interactionOrMessage as ChatInputCommandInteraction
                ).reply({ content: replyContent, ephemeral: true });
            }
            return;
        }

        let currentTeamIds = (process.env.TEAM_ID || "")
            .split(",")
            .filter((id) => id.length > 0);
        const embed = new EmbedBuilder().setColor("#0099ff");
        let envUpdateNeeded = false;
        let baseSuccessMessage = "";

        if (action === "add") {
            if (currentTeamIds.includes(targetUserId)) {
                baseSuccessMessage = `${targetUser.tag} is already in the assigned team.`;
            } else {
                currentTeamIds.push(targetUserId);
                currentTeamIds = [...new Set(currentTeamIds)];
                envUpdateNeeded = true;
                baseSuccessMessage = `Added ${targetUser.tag} to the team.`;
                Logger.info(
                    `User ${targetUser.tag} (${targetUserId}) added to TEAM_ID by ${executorId}`,
                );
            }
        } else if (action === "remove") {
            if (!currentTeamIds.includes(targetUserId)) {
                baseSuccessMessage = `${targetUser.tag} is not in the team.`;
            } else {
                currentTeamIds = currentTeamIds.filter(
                    (id) => id !== targetUserId,
                );
                envUpdateNeeded = true;
                baseSuccessMessage = `Removed ${targetUser.tag} from the team.`;
                Logger.info(
                    `User ${targetUser.tag} (${targetUserId}) removed from TEAM_ID by ${executorId}`,
                );
            }
        }

        const newTeamIdString = currentTeamIds.join(",");
        if (envUpdateNeeded) {
            try {
                await updateEnvFile("TEAM_ID", newTeamIdString);
                process.env.TEAM_ID = newTeamIdString;
                embed.setDescription(
                    `${baseSuccessMessage}\nThe .env file has been updated successfully.`,
                );
            } catch (error: unknown) {
                const e = error as Error;
                Logger.error(
                    "Error during .env file update in assign command:",
                    e,
                );
                embed
                    .setColor("#ffcc00")
                    .setDescription(
                        `${baseSuccessMessage}\n**Warning:** ${targetUser.tag} was ${action === "add" ? "added to" : "removed from"} the team for the current session, but the change **could not be saved to the .env file.**\nError: ${e.message}\nPlease check the bot console. You may need to manually update \`TEAM_ID=${newTeamIdString}\` in your .env file for the change to persist.`,
                    );
            }
        } else {
            embed.setDescription(baseSuccessMessage);
        }

        const replyOptions = { embeds: [embed] };
        if (isPrefix) {
            await (interactionOrMessage as Message).reply(replyOptions);
        } else {
            await (interactionOrMessage as ChatInputCommandInteraction).reply({
                ...replyOptions,
                ephemeral: true,
            });
        }
    },
};
