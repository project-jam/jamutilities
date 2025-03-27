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
    .setName("technical-difficulties")
    .setDescription("Generate a Technical Difficulties image")
    .setDMPermission(true)
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
        .setName("glitch_intensity")
        .setDescription("Glitch intensity (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    )
    .addNumberOption((option) =>
      option
        .setName("noise_intensity")
        .setDescription("Noise intensity (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    )
    .addNumberOption((option) =>
      option
        .setName("scanline_intensity")
        .setDescription("Scanline intensity (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    )
    .addNumberOption((option) =>
      option
        .setName("color_shift_intensity")
        .setDescription("Color shift intensity (1-10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false),
    ),

  prefix: {
    aliases: ["td", "technicaldifficulties"],
    usage:
      "[width] [height] [glitch_intensity] [noise_intensity] [scanline_intensity] [color_shift_intensity]",
  },

  // Added integration types and contexts as specified
  integration_types: [0, 1],
  contexts: [0, 1, 2],

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

        let options: any = {
          width: 1024,
          height: 1024,
          glitchIntensity: 4,
          noiseIntensity: 4,
          scanlineIntensity: 10,
          colorShiftIntensity: 9,
        };

        if (args.length > 0) options.width = parseInt(args[0]);
        if (args.length > 1) options.height = parseInt(args[1]);
        if (args.length > 2) options.glitchIntensity = parseInt(args[2]);
        if (args.length > 3) options.noiseIntensity = parseInt(args[3]);
        if (args.length > 4) options.scanlineIntensity = parseInt(args[4]);
        if (args.length > 5) options.colorShiftIntensity = parseInt(args[5]);

        await handleTechnicalDifficulties(message, options);
      } else {
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();

        const options = {
          width: slashInteraction.options.getNumber("width") || 1024,
          height: slashInteraction.options.getNumber("height") || 1024,
          glitchIntensity:
            slashInteraction.options.getNumber("glitch_intensity") || 4,
          noiseIntensity:
            slashInteraction.options.getNumber("noise_intensity") || 4,
          scanlineIntensity:
            slashInteraction.options.getNumber("scanline_intensity") || 10,
          colorShiftIntensity:
            slashInteraction.options.getNumber("color_shift_intensity") || 9,
        };

        await handleTechnicalDifficulties(slashInteraction, options);
      }
    } catch (error) {
      Logger.error("Technical Difficulties command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ Failed to generate Technical Difficulties image.");

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

async function handleTechnicalDifficulties(
  interaction: ChatInputCommandInteraction | Message,
  options: any,
) {
  try {
    // Construct API URL
    const apiUrl = `https://api.project-jam.is-a.dev/api/v0/image/technical-difficulties?width=${options.width}&height=${options.height}&glitchIntensity=${options.glitchIntensity}&noiseIntensity=${options.noiseIntensity}&scanlineIntensity=${options.scanlineIntensity}&colorShiftIntensity=${options.colorShiftIntensity}`;

    // Fetch the image
    const response = await fetch(apiUrl, { agent });
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    // Convert to buffer
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Create attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "technical-difficulties.png",
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor("#FF0000")
      .setTitle("📺 Technical Difficulties Generated")
      .addFields(
        {
          name: "Dimensions",
          value: `${options.width}x${options.height}`,
          inline: true,
        },
        {
          name: "Glitch Intensity",
          value: options.glitchIntensity.toString(),
          inline: true,
        },
        {
          name: "Noise Intensity",
          value: options.noiseIntensity.toString(),
          inline: true,
        },
        {
          name: "Scanline Intensity",
          value: options.scanlineIntensity.toString(),
          inline: true,
        },
        {
          name: "Color Shift Intensity",
          value: options.colorShiftIntensity.toString(),
          inline: true,
        },
      )
      .setImage("attachment://technical-difficulties.png")
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
