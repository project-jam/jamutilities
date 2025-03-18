import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import https from "https";

// Create a reusable agent for all requests
const agent = new https.Agent({
  rejectUnauthorized: false,
});

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("topographic")
    .setDescription("Generate topographic-related images")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("lines")
        .setDescription("Generate topographic lines image")
        .addNumberOption((option) =>
          option
            .setName("width")
            .setDescription("Width of the image (100-3840)")
            .setMinValue(100)
            .setMaxValue(3840)
            .setRequired(false),
        )
        .addNumberOption((option) =>
          option
            .setName("height")
            .setDescription("Height of the image (100-2160)")
            .setMinValue(100)
            .setMaxValue(2160)
            .setRequired(false),
        )
        .addNumberOption((option) =>
          option
            .setName("thickness")
            .setDescription("Thickness of the lines (1-10)")
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("linecolor")
            .setDescription("Line color in hex (e.g., FFFFFF for white)")
            .setRequired(false)
            .setMinLength(6)
            .setMaxLength(6),
        )
        .addStringOption((option) =>
          option
            .setName("bgcolor")
            .setDescription("Background color in hex (e.g., 000000 for black)")
            .setRequired(false)
            .setMinLength(6)
            .setMaxLength(6),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("wavy")
        .setDescription("Generate wavy topographic lines image")
        .addNumberOption((option) =>
          option
            .setName("width")
            .setDescription("Width of the image (100-3840)")
            .setMinValue(100)
            .setMaxValue(3840)
            .setRequired(false),
        )
        .addNumberOption((option) =>
          option
            .setName("height")
            .setDescription("Height of the image (100-2160)")
            .setMinValue(100)
            .setMaxValue(2160)
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("linecolor")
            .setDescription("Line color in hex (e.g., FFFFFF for white)")
            .setRequired(false)
            .setMinLength(6)
            .setMaxLength(6),
        )
        .addStringOption((option) =>
          option
            .setName("bgcolor")
            .setDescription("Background color in hex (e.g., 000000 for black)")
            .setRequired(false)
            .setMinLength(6)
            .setMaxLength(6),
        ),
    ),

  prefix: {
    aliases: ["topo", "topographic", "tlines", "topowavy", "twavy", "topogen"],
    usage: "<lines/wavy> [width] [height] [thickness] [linecolor] [bgcolor]",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      if (isPrefix) {
        const message = interaction as Message;
        const args = message.content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/g);

        const commandUsed = args[0].toLowerCase(); // Get the alias that was used
        args.shift(); // Remove command name

        if (args.length < 1) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please specify a subcommand (lines/wavy)!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}${commandUsed} <type> [options]`,
                    "",
                    "Types:",
                    "• lines - Regular topographic lines",
                    "• wavy - Wavy topographic lines",
                    "",
                    "Options:",
                    "• width (100-3840)",
                    "• height (100-2160)",
                    "• thickness (1-10, lines only)",
                    "• linecolor (hex, e.g., FFFFFF)",
                    "• bgcolor (hex, e.g., 000000)",
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}${commandUsed} lines 1920 1080 3 FFFFFF 000000`,
                    `${process.env.PREFIX || "jam!"}${commandUsed} wavy 1920 1080 FFFFFF 000000`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        const subcommand = args[0].toLowerCase();
        let options: any = {
          width: 1920,
          height: 1080,
          thickness: 3,
          linecolor: "FFFFFF",
          bgcolor: "000000",
        };

        if (subcommand === "lines") {
          if (args[1]) options.width = parseInt(args[1]);
          if (args[2]) options.height = parseInt(args[2]);
          if (args[3]) options.thickness = parseInt(args[3]);
          if (args[4]) options.linecolor = args[4];
          if (args[5]) options.bgcolor = args[5];
          await handleTopographicLines(message, options);
        } else if (subcommand === "wavy") {
          if (args[1]) options.width = parseInt(args[1]);
          if (args[2]) options.height = parseInt(args[2]);
          if (args[3]) options.linecolor = args[3];
          if (args[4]) options.bgcolor = args[4];
          await handleTopographicWavy(message, options);
        } else {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ Invalid subcommand! Use 'lines' or 'wavy'.",
                ),
            ],
          });
        }
      } else {
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();

        const subcommand = slashInteraction.options.getSubcommand();
        const options = {
          width: slashInteraction.options.getNumber("width") || 1920,
          height: slashInteraction.options.getNumber("height") || 1080,
          thickness: slashInteraction.options.getNumber("thickness") || 3,
          linecolor:
            slashInteraction.options.getString("linecolor") || "FFFFFF",
          bgcolor: slashInteraction.options.getString("bgcolor") || "000000",
        };

        if (subcommand === "lines") {
          await handleTopographicLines(slashInteraction, options);
        } else if (subcommand === "wavy") {
          await handleTopographicWavy(slashInteraction, options);
        }
      }
    } catch (error) {
      Logger.error("Topographic command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ Failed to generate topographic image.");

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

async function handleTopographicLines(
  interaction: ChatInputCommandInteraction | Message,
  options: any,
) {
  try {
    // Validate options
    const hexColorRegex = /^[0-9A-Fa-f]{6}$/;
    if (
      !hexColorRegex.test(options.linecolor) ||
      !hexColorRegex.test(options.bgcolor)
    ) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Invalid hex color format. Use format like 'FFFFFF'.",
        );

      if (interaction instanceof Message) {
        await interaction.reply({ embeds: [errorEmbed] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed] });
      }
      return;
    }

    // Construct API URL
    const apiUrl = `https://api.project-jam.is-a.dev/api/v0/image/topographic-lines?width=${options.width}&height=${options.height}&thickness=${options.thickness}&lineColor=${options.linecolor}&bgColor=${options.bgcolor}`;

    // Fetch the image
    const response = await fetch(apiUrl, { agent });
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    // Convert to buffer
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "topographic-lines.png",
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(`#${options.linecolor}`)
      .setTitle("🗺️ Topographic Lines Generated")
      .addFields(
        {
          name: "Dimensions",
          value: `${options.width}x${options.height}`,
          inline: true,
        },
        {
          name: "Line Thickness",
          value: options.thickness.toString(),
          inline: true,
        },
        {
          name: "Colors",
          value: `Lines: #${options.linecolor}\nBackground: #${options.bgcolor}`,
          inline: true,
        },
      )
      .setImage("attachment://topographic-lines.png")
      .setTimestamp();

    if (interaction instanceof Message) {
      await interaction.reply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    }
  } catch (error) {
    throw error;
  }
}

async function handleTopographicWavy(
  interaction: ChatInputCommandInteraction | Message,
  options: any,
) {
  try {
    // Validate options
    const hexColorRegex = /^[0-9A-Fa-f]{6}$/;
    if (
      !hexColorRegex.test(options.linecolor) ||
      !hexColorRegex.test(options.bgcolor)
    ) {
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Invalid hex color format. Use format like 'FFFFFF'.",
        );

      if (interaction instanceof Message) {
        await interaction.reply({ embeds: [errorEmbed] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed] });
      }
      return;
    }

    // Construct API URL
    const apiUrl = `https://api.project-jam.is-a.dev/api/v0/image/topographic-lines?width=${options.width}&height=${options.height}&lineColor=${options.linecolor}&bgColor=${options.bgcolor}&wavy=true`;

    // Fetch the image
    const response = await fetch(apiUrl, { agent });
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    // Convert to buffer
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "topographic-wavy-lines.png",
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(`#${options.linecolor}`)
      .setTitle("🌊 Wavy Topographic Lines Generated")
      .addFields(
        {
          name: "Dimensions",
          value: `${options.width}x${options.height}`,
          inline: true,
        },
        {
          name: "Colors",
          value: `Lines: #${options.linecolor}\nBackground: #${options.bgcolor}`,
          inline: true,
        },
      )
      .setImage("attachment://topographic-wavy-lines.png")
      .setTimestamp();

    if (interaction instanceof Message) {
      await interaction.reply({ embeds: [embed], files: [attachment] });
    } else {
      await interaction.editReply({ embeds: [embed], files: [attachment] });
    }
  } catch (error) {
    throw error;
  }
}
