import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

// Dice emojis for d6
const diceEmojis = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

// Decorative elements
const diceDecorations = [
  "🎲",
  "🎯",
  "🎪",
  "✨",
  "💫",
  "⭐",
  "🌟",
  "🎮",
  "🎨",
  "🎭",
  "🎪",
  "🎱",
  "🎳",
  "🎰",
  "🎲",
  "🎯",
];

function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => diceDecorations[Math.floor(Math.random() * diceDecorations.length)],
    )
    .join(" ");
}

// Function to roll dice and get results
function rollDice(sides: number, count: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * sides) + 1);
  }
  return results;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll different types of dice!")
    .setDMPermission(true)
    .addNumberOption((option) =>
      option
        .setName("type")
        .setDescription("Type of dice to roll (6, 12, or 18 sides)")
        .setRequired(true)
        .addChoices(
          { name: "6-sided (d6)", value: 6 },
          { name: "12-sided (d12)", value: 12 },
          { name: "18-sided (d18)", value: 18 },
        ),
    )
    .addNumberOption((option) =>
      option
        .setName("count")
        .setDescription("Number of dice to roll (1-3)")
        .setRequired(false)
        .addChoices(
          { name: "1 die", value: 1 },
          { name: "2 dice", value: 2 },
          { name: "3 dice", value: 3 },
        ),
    ),

  prefix: {
    aliases: ["dice", "roll", "d"],
    usage: "<type> [count]", // Example: jam!roll 6 2
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let diceType: number;
      let diceCount: number;

      if (isPrefix) {
        // Handle prefix command
        const message = interaction as Message;
        const args = message.content.trim().split(/ +/).slice(1);

        // Parse arguments
        diceType = parseInt(args[0]);
        diceCount = args[1] ? parseInt(args[1]) : 1;

        // Validate dice type
        if (![6, 12, 18].includes(diceType)) {
          const prefix = process.env.PREFIX || "jam!";
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ Please specify a valid dice type (6, 12, or 18)!",
                )
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <type> [count]`)
                    .concat("Example: `jam!roll 6 2` - Rolls two d6 dice")
                    .join("\n"),
                }),
            ],
          });
          return;
        }

        // Validate dice count
        if (diceCount < 1 || diceCount > 3) {
          diceCount = 1;
        }
      } else {
        // Handle slash command
        const slashInteraction = interaction as ChatInputCommandInteraction;
        diceType = slashInteraction.options.getNumber("type", true);
        diceCount = slashInteraction.options.getNumber("count") || 1;
      }

      const results = rollDice(diceType, diceCount);
      const total = results.reduce((sum, num) => sum + num, 0);
      const average = (total / results.length).toFixed(1);

      // Create visual representation
      let visualDice = "";
      if (diceType === 6) {
        visualDice = results
          .map((num) => diceEmojis[num as keyof typeof diceEmojis])
          .join(" ");
      } else {
        visualDice = results.map((num) => `[${num}]`).join(" ");
      }

      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#4CAF50")
        .setTitle(`${topDecorations} Dice Roll Results ${topDecorations}`)
        .setDescription(`Rolling ${diceCount}d${diceType}...\n\n${visualDice}`)
        .addFields(
          {
            name: "Individual Results",
            value: results.join(", "),
            inline: true,
          },
          { name: "Total", value: total.toString(), inline: true },
          { name: "Average", value: average.toString(), inline: true },
        )
        .setFooter({
          text: `Rolled by ${isPrefix ? (interaction as Message).author.tag : (interaction as ChatInputCommandInteraction).user.tag}`,
          iconURL: isPrefix
            ? (interaction as Message).author.displayAvatarURL()
            : (
                interaction as ChatInputCommandInteraction
              ).user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add bottom decorations
      embed.setDescription(
        `Rolling ${diceCount}d${diceType}...\n\n${visualDice}\n\n${bottomDecorations}`,
      );

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Dice command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ The dice fell off the table! Try again!");

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
