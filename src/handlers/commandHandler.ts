import {
    Client,
    Collection,
    REST,
    Routes,
    ChatInputCommandInteraction,
    Message,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { Logger } from "../utils/logger";
import type { Command } from "../types/Command";

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
                if (interaction.user.id === process.env.OWNER_ID) {
                    await command.execute(interaction);
                } else {
                    await interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ff3838")
                                .setDescription(
                                    "This command is currently disabled.",
                                ),
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
        const commandName = args.shift()?.toLowerCase();
        if (!commandName) return;

        // Get command from either direct name or alias
        const command =
            this.commands.get(commandName) ||
            this.commands.get(this.aliases.get(commandName) || "");

        if (!command) {
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ff3838")
                        .setDescription(
                            `❌ \`${message.content}\` command not found. Use \`${prefix}help\` to see all available commands.`,
                        ),
                ],
            });
            return;
        }

        // ✅ Check if command is disabled
        if (
            this.isCommandDisabled(command.data.name) &&
            message.author.id !== process.env.OWNER_ID
        ) {
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ff3838")
                        .setDescription("This command is currently disabled."),
                ],
            });
            return;
        }

        // Special handling for commands with subcommands that need quotes
        if (commandName === "image" && args[0] === "search") {
            const searchQuery = args.slice(1).join(" ");
            args[0] = "search";
            args[1] = searchQuery;
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
                `${message.author.tag} [${message.author.id}] used ${prefix}${commandName} in ${message.guild?.name || "DM"}`,
            );
            await command.execute(message, true);
        } catch (error) {
            Logger.error(
                `Error executing prefix command ${commandName}:`,
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
        return this.disabledCommands.has(commandString.toLowerCase());
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
