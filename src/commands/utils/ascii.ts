import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
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
  "Shimrod",
  "Small",
  "Speed",
  "Stampatello",
  "Univers",
  "USA Flag",
  "колокол",
];

export const command = {
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

  prefix: {
    aliases: ["ascii", "figlet", "text"],
    usage: "[font] <text> OR list", // Example: jam!ascii Standard hi, jam!ascii list
  },

  async execute(interaction, isPrefix = false) {
    try {
      if (isPrefix) {
        const message = interaction as Message;
        const args = message.content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/);

        args.shift(); // Remove command name

        if (args.length === 0) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ Please provide a font and text or use 'list' to see available fonts!",
                )
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}ascii [font] <text>`,
                    `${process.env.PREFIX || "jam!"}ascii list`,
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}ascii Standard Hello`,
                    `${process.env.PREFIX || "jam!"}ascii Big "Hello World"`,
                    `${process.env.PREFIX || "jam!"}ascii list`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        // Check if user wants to see the font list
        if (args[0].toLowerCase() === "list") {
          const fontListEmbed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("Available ASCII Fonts")
            .setDescription(figletFonts.join("\n"))
            .setFooter({
              text: `Usage: ${process.env.PREFIX || "jam!"}ascii <font> <text>`,
            });

          await message.reply({ embeds: [fontListEmbed] });
          return;
        }

        const selectedFont = args[0];
        const text = args.slice(1).join(" ");

        if (!text) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide text to convert!"),
            ],
          });
          return;
        }

        if (!figletFonts.includes(selectedFont)) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  `❌ Invalid font! Use \`${process.env.PREFIX || "jam!"}ascii list\` to see available fonts.`,
                ),
            ],
          });
          return;
        }

        if (text.length > 100) {
          await message.reply({
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

        await message.channel.sendTyping();

        const asciiArt = figlet.textSync(text, {
          font: selectedFont,
          horizontalLayout: "default",
          verticalLayout: "default",
        });

        const asciiOutput = `\`\`\`ansi\n${asciiArt}\`\`\``;

        if (asciiOutput.length > 2000) {
          const trimmedArt = asciiArt.substring(0, 2000 - 10);
          const trimmedOutput = `\`\`\`ansi\n${trimmedArt}...\`\`\``;
          await message.reply({ content: trimmedOutput });
        } else {
          await message.reply({ content: asciiOutput });
        }
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        const text = (
          interaction as ChatInputCommandInteraction
        ).options.getString("text", true);
        const selectedFont =
          (interaction as ChatInputCommandInteraction).options.getString(
            "font",
          ) || "Standard";

        if (text.length > 100) {
          await (interaction as ChatInputCommandInteraction).editReply({
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

        const asciiArt = figlet.textSync(text, {
          font: selectedFont,
          horizontalLayout: "default",
          verticalLayout: "default",
        });

        const asciiOutput = `\`\`\`ansi\n${asciiArt}\`\`\``;

        if (asciiOutput.length > 2000) {
          const trimmedArt = asciiArt.substring(0, 2000 - 10);
          const trimmedOutput = `\`\`\`ansi\n${trimmedArt}...\`\`\``;
          await (interaction as ChatInputCommandInteraction).editReply({
            content: trimmedOutput,
          });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            content: asciiOutput,
          });
        }
      }
    } catch (error) {
      Logger.error("ASCII art generation failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Failed to generate ASCII art. There might be issues with this particular font or the text you provided.",
        );

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
