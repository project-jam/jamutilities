import {
  ChatInputCommandInteraction,
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
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Get detailed info about a specific command")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const category = interaction.options.getString("category");
    const commandName = interaction.options.getString("command");

    // Load commands from files
    const commands = new Collection<string, Command>();
    const commandsPath = join(__dirname, "..", "..");
    const categoryFolders = readdirSync(join(commandsPath, "commands")).filter(
      (folder) => folder !== "owner",
    );

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

    if (commandName) {
      // Show detailed info for specific command
      const cmd = commands.get(commandName);
      if (!cmd) {
        await interaction.editReply({
          content: `❌ Command \`${commandName}\` not found.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle(`Command: /${cmd.data.name}`)
        .setDescription(cmd.data.description)
        .addFields(
          {
            name: "Category",
            value: getCategoryForCommand(cmd, categoryFolders) || "Unknown",
            inline: true,
          },
          {
            name: "DM Capable",
            value: cmd.data.dm_permission ? "Yes" : "No",
            inline: true,
          },
        );

      // Add options if they exist
      if (cmd.data.options?.length) {
        const optionsField = cmd.data.options
          .map((opt) => {
            const required = opt.required ? "*(required)*" : "*(optional)*";
            const type = getOptionTypeName(opt.type);
            return `• \`${opt.name}\`: ${opt.description} ${required}\n  Type: ${type}`;
          })
          .join("\n");

        embed.addFields({ name: "Options", value: optionsField });
      }

      // Add usage examples if available
      if (cmd.data.options?.length) {
        const usage = [`\`/${cmd.data.name}\``];
        cmd.data.options.forEach((opt) => {
          usage.push(
            `\`/${cmd.data.name} ${opt.name}:${getOptionExample(opt.type)}\``,
          );
        });
        embed.addFields({ name: "Usage Examples", value: usage.join("\n") });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (category) {
      // Show commands for specific category
      const categoryCommands = commands.filter(
        (cmd) =>
          getCategoryForCommand(cmd, categoryFolders).toLowerCase() ===
          category.toLowerCase(),
      );

      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle(
          `${categories[category].emoji} ${capitalize(category)} Commands`,
        )
        .setDescription(categories[category].description);

      categoryCommands.forEach((cmd) => {
        embed.addFields({
          name: `/${cmd.data.name}`,
          value: `${cmd.data.description}\n${
            cmd.data.options?.length
              ? `*Options: ${cmd.data.options.map((opt) => `\`${opt.name}\``).join(", ")}*`
              : ""
          }`,
        });
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Show all categories
    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("📚 Command Categories")
      .setDescription(
        "Use `/help category:<category>` for specific commands\nUse `/help command:<command>` for detailed command info",
      )
      .addFields(
        Object.entries(categories).map(([name, { emoji, description }]) => ({
          name: `${emoji} ${capitalize(name)}`,
          value: `${description}\nCommands: ${
            commands.filter(
              (cmd) =>
                getCategoryForCommand(cmd, categoryFolders).toLowerCase() ===
                name.toLowerCase(),
            ).size
          }`,
          inline: true,
        })),
      )
      .setFooter({
        text: "Tip: Click on category names to see their commands!",
      });

    await interaction.editReply({ embeds: [embed] });
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
  };
  return types[type] || "Unknown";
}

function getOptionExample(type: number): string {
  const examples: { [key: number]: string } = {
    [ApplicationCommandOptionType.String]: "text",
    [ApplicationCommandOptionType.Integer]: "42",
    [ApplicationCommandOptionType.Boolean]: "true",
    [ApplicationCommandOptionType.User]: "@user",
    [ApplicationCommandOptionType.Channel]: "#channel",
    [ApplicationCommandOptionType.Role]: "@role",
    [ApplicationCommandOptionType.Number]: "3.14",
    [ApplicationCommandOptionType.Mentionable]: "@user/@role",
  };
  return examples[type] || "value";
}
