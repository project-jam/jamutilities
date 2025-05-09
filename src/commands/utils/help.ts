import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    Collection,
    ApplicationCommandOptionType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { readdirSync } from "fs";
import { join } from "path";

interface CommandCategory {
    name: string;
    emoji: string;
    description: string;
    commands: Collection<string, Command>;
}

const categories: { [key: string]: { emoji: string; description: string } } = {
    fun: {
        emoji: "🎮",
        description: "Fun and interactive commands to enjoy with others",
    },
    utils: {
        emoji: "🛠️",
        description: "Utility commands for various purposes",
    },
    moderation: {
        emoji: "🛡️",
        description: "Commands for server moderation",
    },
    research: {
        emoji: "🔍",
        description: "Commands for searching and finding information",
    },
    music: {
        emoji: "🎵",
        description: "Music playback and queue controls",
    },
};

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Shows information about bot commands")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("category")
                .setDescription("Specific command category to view")
                .addChoices(
                    { name: "🎮 Fun", value: "fun" },
                    { name: "🛠️ Utilities", value: "utils" },
                    { name: "🛡️ Moderation", value: "moderation" },
                    { name: "🔍 Research", value: "research" },
                    { name: "🎵 Music", value: "music" },
                )
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("command")
                .setDescription("Get detailed info about a specific command")
                .setRequired(false),
        ),

    prefix: {
        aliases: ["help", "commands", "h"],
        usage: "[category|command]",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        if (!isPrefix) {
            await (interaction as ChatInputCommandInteraction).deferReply();
        }

        let category: string | null = null;
        let commandName: string | null = null;
        const prefix = process.env.PREFIX || "jam!";

        if (isPrefix) {
            const args = (interaction as Message).content.trim().split(" ");
            const query = args[1]?.toLowerCase();

            if (query) {
                if (Object.keys(categories).includes(query)) {
                    category = query;
                } else {
                    commandName = query;
                }
            }
        } else {
            category = (
                interaction as ChatInputCommandInteraction
            ).options.getString("category");
            commandName = (
                interaction as ChatInputCommandInteraction
            ).options.getString("command");
        }

        // Load commands from files
        const commands = new Collection<string, Command>();
        const commandsPath = join(__dirname, "..", "..");
        const categoryFolders = readdirSync(
            join(commandsPath, "commands"),
        ).filter((folder) => folder !== "owner");

        for (const folder of categoryFolders) {
            const commandFiles = readdirSync(
                join(commandsPath, "commands", folder),
            ).filter((file) => file.endsWith(".ts"));

            for (const file of commandFiles) {
                const { command } = await import(
                    join(commandsPath, "commands", folder, file)
                );
                if ("data" in command && "execute" in command) {
                    commands.set(command.data.name, command);
                }
            }
        }

        // Specific command help
        if (commandName) {
            const cmd = commands.get(commandName);
            if (!cmd) {
                const response = `❌ Command \`${commandName}\` not found.`;
                if (isPrefix) {
                    await (interaction as Message).reply({ content: response });
                } else {
                    await (
                        interaction as ChatInputCommandInteraction
                    ).editReply({
                        content: response,
                    });
                }
                return;
            }

            const embed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle(`Command: ${cmd.data.name}`)
                .setDescription(cmd.data.description)
                .addFields(
                    {
                        name: "Category",
                        value:
                            getCategoryForCommand(cmd, categoryFolders) ||
                            "Unknown",
                        inline: true,
                    },
                    {
                        name: "DM Capable",
                        value: cmd.data.dm_permission ? "Yes" : "No",
                        inline: true,
                    },
                );

            // Add slash command usage
            embed.addFields({
                name: "Slash Command Usage",
                value: `\`/${cmd.data.name}\``,
            });

            // Add prefix command usage if available
            if (cmd.prefix) {
                const aliases = cmd.prefix.aliases
                    .map((alias) => `${prefix}${alias}`)
                    .join(", ");
                embed.addFields({
                    name: "Prefix Command Usage",
                    value: `${aliases}\nUsage: \`${prefix}${cmd.data.name} ${cmd.prefix.usage || ""}\``,
                });
            }

            // Add subcommands if they exist
            const subcommands = cmd.data.options?.filter(
                (opt) => opt.type === ApplicationCommandOptionType.Subcommand,
            );
            if (subcommands?.length) {
                const subcommandList = subcommands
                    .map(
                        (sub) =>
                            `• \`/${cmd.data.name} ${sub.name}\` - ${sub.description}`,
                    )
                    .join("\n");
                embed.addFields({ name: "Subcommands", value: subcommandList });
            }

            // Add regular options if they exist
            const options = cmd.data.options?.filter(
                (opt) => opt.type !== ApplicationCommandOptionType.Subcommand,
            );
            if (options?.length) {
                const optionsField = options
                    .map((opt) => {
                        const required = opt.required
                            ? "*(required)*"
                            : "*(optional)*";
                        const type = getOptionTypeName(opt.type);
                        return `• \`${opt.name}\`: ${opt.description} ${required}\n  Type: ${type}`;
                    })
                    .join("\n");

                embed.addFields({ name: "Options", value: optionsField });
            }

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [embed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [embed],
                });
            }
            return;
        }

        // Category specific help
        if (category) {
            const categoryCommands = commands.filter(
                (cmd) =>
                    getCategoryForCommand(
                        cmd,
                        categoryFolders,
                    ).toLowerCase() === category.toLowerCase(),
            );

            const embed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle(
                    `${categories[category].emoji} ${capitalize(category)} Commands`,
                )
                .setDescription(categories[category].description);

            categoryCommands.forEach((cmd) => {
                let fieldValue = cmd.data.description;

                // Add prefix aliases if available
                if (cmd.prefix) {
                    const aliases = cmd.prefix.aliases
                        .map((alias) => `${prefix}${alias}`)
                        .join(", ");
                    fieldValue += `\n**Prefix:** ${aliases}`;
                }

                // Add options if available
                if (cmd.data.options?.length) {
                    fieldValue += `\n**Options:** ${cmd.data.options.map((opt) => `\`${opt.name}\``).join(", ")}`;
                }

                embed.addFields({
                    name: `/${cmd.data.name}`,
                    value: fieldValue,
                });
            });

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [embed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [embed],
                });
            }
            return;
        }

        // General help - show all categories
        const embed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("📚 Command Categories")
            .setDescription(
                `Use \`${prefix}help <category>\` or \`/help category:<category>\` for specific commands\n` +
                    `Use \`${prefix}help <command>\` or \`/help command:<command>\` for detailed command info`,
            )
            .addFields(
                Object.entries(categories).map(
                    ([name, { emoji, description }]) => ({
                        name: `${emoji} ${capitalize(name)}`,
                        value: `${description}\nCommands: ${
                            commands.filter(
                                (cmd) =>
                                    getCategoryForCommand(
                                        cmd,
                                        categoryFolders,
                                    ).toLowerCase() === name.toLowerCase(),
                            ).size
                        }`,
                        inline: true,
                    }),
                ),
            )
            .setFooter({
                text: `Tip: You can use both ${prefix} prefix or / commands!`,
            });

        if (isPrefix) {
            await (interaction as Message).reply({ embeds: [embed] });
        } else {
            await (interaction as ChatInputCommandInteraction).editReply({
                embeds: [embed],
            });
        }
    },
};

// Helper functions
function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getCategoryForCommand(command: Command, categories: string[]): string {
    for (const category of categories) {
        const commandFiles = readdirSync(
            join(__dirname, "..", "..", "commands", category),
        );
        if (commandFiles.some((file) => file.includes(command.data.name))) {
            return capitalize(category);
        }
    }
    return "Uncategorized";
}

function getOptionTypeName(type: number): string {
    const types: { [key: number]: string } = {
        [ApplicationCommandOptionType.String]: "Text",
        [ApplicationCommandOptionType.Integer]: "Number (whole)",
        [ApplicationCommandOptionType.Boolean]: "True/False",
        [ApplicationCommandOptionType.User]: "User",
        [ApplicationCommandOptionType.Channel]: "Channel",
        [ApplicationCommandOptionType.Role]: "Role",
        [ApplicationCommandOptionType.Number]: "Number (decimal)",
        [ApplicationCommandOptionType.Mentionable]: "User or Role",
        [ApplicationCommandOptionType.Attachment]: "File",
    };
    return types[type] || "Unknown";
}
