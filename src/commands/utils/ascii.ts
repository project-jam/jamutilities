import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
  ApplicationCommandOptionType,
} from "discord.js";
import type { Command } from "../../types/Command";
import figlet from "figlet";
import { Logger } from "../../utils/logger";

// List of Figlet fonts, prioritizing monospace-friendly ones
const figletFonts = [
  "Standard",
  "Big",
  "Banner",
  "Block",
  "Bulbhead",
  "Cybermedium",
  "Doom",
  "Epic",
  "Flowerpower",
  "Graceful",
  "Isometric1",
  "Larry 3d",
  "Lean",
  "Letters",
  " নেয়Quաղw",
  "Shimrod",
  "Small",
  "Speed",
  "Stampatello",
  " কম্পিউটার",
  "Univers",
  "USA Flag",
  "колокол",
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ascii")
    .setDescription("Convert text to ASCII art with font selection")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("The text to convert to ASCII art")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("font")
        .setDescription("Choose the FIGlet font for the ASCII art")
        .setRequired(false)
        .addChoices(
          ...figletFonts.map((font) => ({ name: font, value: font })),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const text = interaction.options.getString("text", true);
    const selectedFont = interaction.options.getString("font") || "Standard";

    // Validate text length - reduced for safety
    if (text.length > 100) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Text is too long! Please keep it under 100 characters for best results.",
            ),
        ],
      });
      return;
    }

    try {
      // Generate ASCII art with selected font
      const asciiArt = figlet.textSync(text, {
        font: selectedFont,
        horizontalLayout: "default",
        verticalLayout: "default",
      });

      // Removed debug log output: Logger.debug(`Generated ASCII Art (${selectedFont}):\n${asciiArt}`);

      const asciiOutput = `\`\`\`ansi\n${asciiArt}\`\`\``;

      if (asciiOutput.length > 2000) {
        const trimmedArt = asciiArt.substring(0, 2000 - 10);
        const trimmedOutput = `\`\`\`ansi\n${trimmedArt}...\`\`\``;

        await interaction.editReply({
          content: trimmedOutput, // FIX: Just send the trimmed ASCII art
        });
      } else {
        await interaction.editReply({
          content: asciiOutput, // FIX: Just send the ASCII art directly
        });
      }
    } catch (error) {
      Logger.error("ASCII art generation failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to generate ASCII art with the selected font. There might be issues with this particular font or the text you provided.",
            ),
        ],
        content: "",
      });
    }
  },
};
