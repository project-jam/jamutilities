import {
    Client,
    Collection,
    REST,
    Routes,
    ChatInputCommandInteraction,
    Message,
    EmbedBuilder,
    MessageFlags,
    Interaction,
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { Logger } from "../utils/logger";
import type { Command } from "../types/Command";
import { handlePasswordInteraction } from "./passwordHandler";

export class CommandHandler {
    private commands: Collection<string, Command> = new Collection();
    private aliases: Collection<string, string> = new Collection();
    private client: Client;
    private disabledCommands: Set<string>;
    private cooldowns: Collection<string, Collection<string, number>> =
        new Collection();

    constructor(client: Client) {
        this.client = client;
        this.disabledCommands = new Set(
            process.env.DISABLED_COMMANDS?.split(",")
                .map((cmd) => cmd.trim())
                .filter((cmd) => cmd.length > 0)
                .map((cmd) => cmd.toLowerCase()) || [],
        );
    }

    private isUserOwner(userId: string): boolean {
        return userId === process.env.OWNER_ID;
    }

    private isUserInTeam(userId: string): boolean {
        const teamIds = (process.env.TEAM_ID || "")
            .split(",")
            .filter((id) => id.length > 0);
        return teamIds.includes(userId);
    }

    async loadCommands() {
        const commandsPath = join(__dirname, "..", "commands");
        const commandFolders = readdirSync(commandsPath, {
            withFileTypes: true,
        })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

        const categoryCommands = new Map<string, string[]>();
        let totalLoaded = 0;

        for (const folder of commandFolders) {
            const folderPath = join(commandsPath, folder);
            const commandFiles = readdirSync(folderPath).filter((file) =>
                file.endsWith(".ts"),
            );

            const loadedCommands: string[] = [];

            for (const file of commandFiles) {
                const filePath = join(folderPath, file);
                try {
                    const { command } = await import(filePath);

                    if ("data" in command && "execute" in command) {
                        // Store main command
                        this.commands.set(command.data.name, command);
                        loadedCommands.push(command.data.name);
                        totalLoaded++;

                        // Store aliases if prefix configuration exists
                        if (
                            command.prefix &&
                            Array.isArray(command.prefix.aliases)
                        ) {
                            command.prefix.aliases.forEach((alias) => {
                                this.aliases.set(
                                    alias.toLowerCase(),
                                    command.data.name,
                                );
                            });
                        }
                    }
                } catch (error) {
                    Logger.error(`Error loading command ${file}:`, error);
                }
            }

            if (loadedCommands.length > 0) {
                categoryCommands.set(folder, loadedCommands);
            }
        }

        Logger.info("Loaded commands:");
        for (const [category, commands] of categoryCommands) {
            const commandList = commands
                .map((cmd) => {
                    const isDisabled = Array.from(this.disabledCommands).some(
                        (disabled) => disabled.startsWith(cmd.toLowerCase()),
                    );
                    if (isDisabled) {
                        return `${cmd} (disabled)`;
                    }
                    return cmd;
                })
                .join(", ");

            Logger.info(`${category}: ${commandList}`);
        }

        Logger.success(
            `\nTotal: ${totalLoaded} commands loaded (${this.disabledCommands.size} disabled)\n`,
        );
    }

    async registerCommands() {
        try {
            const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
            const commandsData = Array.from(this.commands.values()).map(
                (command) => command.data.toJSON(),
            );

            Logger.info(`Started refreshing application (/) commands.`);

            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
                body: commandsData,
            });

            Logger.success("Successfully registered application commands.");
        } catch (error) {
            Logger.error("Error registering commands:", error);
            throw error;
        }
    }

    async handleCommand(interaction: ChatInputCommandInteraction) {
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        try {
            const commandName = interaction.commandName;
            const subCommand = interaction.options.getSubcommand(false);
            const fullCommand = subCommand
                ? `${commandName} ${subCommand}`
                : commandName;
            const location = interaction.guild?.name || "DM";

            Logger.command(
                `${interaction.user.tag} [${interaction.user.id}] used /${fullCommand} in ${location}`,
            );

            const commandString = interaction.options.getSubcommand(false)
                ? `${interaction.commandName} ${interaction.options.getSubcommand()}`
                : interaction.commandName;

            if (this.isCommandDisabled(commandString)) {
                const userId = interaction.user.id;
                let canExecuteDisabled = false;

                if (this.isUserOwner(userId)) {
                    canExecuteDisabled = true;
                } else if (this.isUserInTeam(userId)) {
                    // Team members can use disabled commands, EXCEPT for 'shell'
                    if (command.data.name.toLowerCase() !== "shell") {
                        canExecuteDisabled = true;
                    }
                }

                if (canExecuteDisabled) {
                    await command.execute(interaction);
                } else {
                    let replyMessage = "This command is currently disabled.";
                    if (
                        this.isUserInTeam(userId) &&
                        command.data.name.toLowerCase() === "shell"
                    ) {
                        replyMessage =
                            "The 'shell' command is restricted to the bot owner.";
                    }
                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(replyMessage),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return;
            }

            await command.execute(interaction);
        } catch (error) {
            Logger.error(
                `Command execution failed: ${interaction.commandName}`,
                error,
            );

            try {
                const errorMessage = {
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(
                                "An error occurred while executing this command.",
                            ),
                    ],
                    flags: MessageFlags.Ephemeral,
                };

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply(errorMessage);
                } else if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                }
            } catch (followUpError) {
                Logger.error("Error sending error message:", followUpError);
            }
        }
    }

    async handlePrefixCommand(message: Message) {
        if (!process.env.ENABLE_PREFIX_COMMANDS?.toLowerCase() === "true")
            return;

        const prefix = process.env.PREFIX || "jam!";
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandNameArg = args.shift()?.toLowerCase();
        if (!commandNameArg) return;

        const command =
            this.commands.get(commandNameArg) ||
            this.commands.get(this.aliases.get(commandNameArg) || "");

        if (!command) {
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ff3838")
                        .setDescription(
                            `❌ \`${message.content.split(" ")[0]}\` command not found. Use \`${prefix}help\` to see all available commands.`,
                        ),
                ],
            });
            return;
        }

        // ✅ Check if command is disabled
        const commandIdentifierForDisabledCheck = command.data.name; // Using base command name for consistency
        if (this.isCommandDisabled(commandIdentifierForDisabledCheck)) {
            const userId = message.author.id;
            let canExecuteDisabled = false;

            if (this.isUserOwner(userId)) {
                canExecuteDisabled = true;
            } else if (this.isUserInTeam(userId)) {
                if (command.data.name.toLowerCase() !== "shell") {
                    canExecuteDisabled = true;
                }
            }

            if (canExecuteDisabled) {
                // Proceed to execute
            } else {
                let replyMessage = "This command is currently disabled.";
                if (
                    this.isUserInTeam(userId) &&
                    command.data.name.toLowerCase() === "shell"
                ) {
                    replyMessage =
                        "The 'shell' command is restricted to the bot owner.";
                }
                await message.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ff3838")
                            .setDescription(replyMessage),
                    ],
                });
                return;
            }
        }

        // Special handling for commands with subcommands that need quotes (example)
        // Adjusted to use command.data.name for checking against 'image'
        if (command.data.name === "image" && args[0] === "search") {
            const searchQuery = args.slice(1).join(" ");
            args[0] = "search"; // This assumes 'search' is the first arg after command name
            // Ensure args array is structured as command expects, potentially args = ['search', searchQuery]
            // Depending on how execute expects args, this might need adjustment
            // For now, let's ensure args are [subcommand, ...options]
            if (args.length > 1) args[1] = searchQuery;
            else args.push(searchQuery);
            args.splice(2); // Keep only 'search' and 'searchQuery'
        }

        // Handle cooldowns
        if (command.cooldown) {
            if (!this.cooldowns.has(command.data.name)) {
                this.cooldowns.set(command.data.name, new Collection());
            }

            const now = Date.now();
            const timestamps = this.cooldowns.get(command.data.name);
            const cooldownAmount = command.cooldown * 1000;

            if (timestamps?.has(message.author.id)) {
                const expirationTime =
                    timestamps.get(message.author.id)! + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    await message.channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    `⏰ Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`,
                                ),
                        ],
                    });
                    return;
                }
            }

            timestamps?.set(message.author.id, now);
            setTimeout(
                () => timestamps?.delete(message.author.id),
                cooldownAmount,
            );
        }

        try {
            Logger.command(
                `${message.author.tag} [${message.author.id}] used ${prefix}${commandNameArg} in ${message.guild?.name || "DM"}`,
            );
            await command.execute(message, true, args); // Pass modified args
        } catch (error) {
            Logger.error(
                `Error executing prefix command ${commandNameArg}:`,
                error,
            );
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ff3838")
                        .setDescription(
                            "An error occurred while executing this command.",
                        ),
                ],
            });
        }
    }

    public toggleCommand(commandString: string, disable: boolean) {
        const normalizedCommand = commandString.toLowerCase();
        if (disable) {
            this.disabledCommands.add(normalizedCommand);
            Logger.info(`Command "${commandString}" has been disabled.`);
        } else {
            this.disabledCommands.delete(normalizedCommand);
            Logger.info(`Command "${commandString}" has been enabled.`);
        }
    }

    public isCommandDisabled(commandString: string): boolean {
        // Check against base command name and full command string (e.g., command subcommand)
        const commandParts = commandString.toLowerCase().split(" ");
        if (this.disabledCommands.has(commandParts[0])) return true; // base command disabled
        return this.disabledCommands.has(commandString.toLowerCase()); // full command string disabled
    }

    public getCommands(): Collection<string, Command> {
        return this.commands;
    }

    public getAliases(): Collection<string, string> {
        return this.aliases;
    }

    public isPrefixEnabled(): boolean {
        return process.env.ENABLE_PREFIX_COMMANDS?.toLowerCase() === "true";
    }

    public isSlashEnabled(): boolean {
        return process.env.ENABLE_SLASH_COMMANDS?.toLowerCase() === "true";
    }

    public getPrefix(): string {
        return process.env.PREFIX || "jam!";
    }

    public getDisabledCommands(): string[] {
        return Array.from(this.disabledCommands);
    }
}
