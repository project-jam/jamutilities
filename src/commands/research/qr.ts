import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("qr")
    .setDescription("Generate a QR code")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("basic")
        .setDescription("Generate a basic QR code")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("The text or URL to encode in the QR code")
            .setRequired(true),
        )
        .addNumberOption((option) =>
          option
            .setName("size")
            .setDescription("Size of the QR code (default: 400)")
            .setRequired(false),
        )
        .addNumberOption((option) =>
          option
            .setName("margin")
            .setDescription("Margin around the QR code (default: 4)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("dark")
            .setDescription("Dark color in hex (default: 000000)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("light")
            .setDescription("Light color in hex (default: FFFFFF)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("logo")
            .setDescription(
              "URL or path to a logo image to include in the QR code",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("wifi")
        .setDescription("Generate a WiFi QR code")
        .addStringOption((option) =>
          option.setName("ssid").setDescription("WiFi SSID").setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("password")
            .setDescription("WiFi password")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("encryption")
            .setDescription("WiFi encryption type (WPA, WEP, etc.)")
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName("hidden")
            .setDescription("Is the WiFi network hidden?")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sms")
        .setDescription("Generate an SMS QR code")
        .addStringOption((option) =>
          option
            .setName("phone")
            .setDescription("Phone number")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("SMS message")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("tel")
        .setDescription("Generate a telephone QR code")
        .addStringOption((option) =>
          option
            .setName("phone")
            .setDescription("Phone number")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("email")
        .setDescription("Generate an email QR code")
        .addStringOption((option) =>
          option
            .setName("email")
            .setDescription("Email address")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("subject")
            .setDescription("Email subject")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("body")
            .setDescription("Email body")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("vcard")
        .setDescription("Generate a vCard QR code")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Contact name")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("phone")
            .setDescription("Phone number")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("email")
            .setDescription("Email address")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("url")
            .setDescription("Website URL")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("address")
            .setDescription("Physical address")
            .setRequired(false),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();
      let apiUrl: URL;

      switch (subcommand) {
        case "basic":
          apiUrl = await handleBasicQR(interaction);
          break;
        case "wifi":
          apiUrl = await handleWifiQR(interaction);
          break;
        case "sms":
          apiUrl = await handleSmsQR(interaction);
          break;
        case "tel":
          apiUrl = await handleTelQR(interaction);
          break;
        case "email":
          apiUrl = await handleEmailQR(interaction);
          break;
        case "vcard":
          apiUrl = await handleVCardQR(interaction);
          break;
        default:
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Invalid subcommand."),
            ],
          });
          return;
      }

      // Fetch the QR code image
      const response = await fetch(apiUrl.toString());
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      // Convert to buffer
      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Create attachment
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "qr-code.png",
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle("📌 QR Code Generated")
        .setDescription(`Type: ${subcommand}`)
        .setImage("attachment://qr-code.png")
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      Logger.error("QR code command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to generate QR code. Please try again later.",
            ),
        ],
      });
    }
  },
};

async function handleBasicQR(
  interaction: ChatInputCommandInteraction,
): Promise<URL> {
  const text = interaction.options.getString("text", true);
  const size = interaction.options.getNumber("size") || 400;
  const margin = interaction.options.getNumber("margin") || 4;
  const dark = interaction.options.getString("dark") || "000000";
  const light = interaction.options.getString("light") || "FFFFFF";
  const logo = interaction.options.getString("logo");

  // Validate hex colors
  const hexColorRegex = /^[0-9A-Fa-f]{6}$/;
  if (!hexColorRegex.test(dark) || !hexColorRegex.test(light)) {
    throw new Error("Invalid hex color format.");
  }

  const apiUrl = new URL("https://api.project-jam.is-a.dev/api/v0/image/qr");
  apiUrl.searchParams.append("text", text);
  apiUrl.searchParams.append("size", size.toString());
  apiUrl.searchParams.append("margin", margin.toString());
  apiUrl.searchParams.append("dark", dark);
  apiUrl.searchParams.append("light", light);
  if (logo) apiUrl.searchParams.append("logo", logo);

  return apiUrl;
}

async function handleWifiQR(
  interaction: ChatInputCommandInteraction,
): Promise<URL> {
  const ssid = interaction.options.getString("ssid", true);
  const password = interaction.options.getString("password", true);
  const encryption = interaction.options.getString("encryption", true);
  const hidden = interaction.options.getBoolean("hidden") || false;

  const apiUrl = new URL("https://api.project-jam.is-a.dev/api/v0/image/qr");
  apiUrl.searchParams.append("type", "wifi");
  apiUrl.searchParams.append("ssid", ssid);
  apiUrl.searchParams.append("password", password);
  apiUrl.searchParams.append("encryption", encryption);
  apiUrl.searchParams.append("hidden", hidden.toString());

  return apiUrl;
}

async function handleSmsQR(
  interaction: ChatInputCommandInteraction,
): Promise<URL> {
  const phone = interaction.options.getString("phone", true);
  const message = interaction.options.getString("message", true);

  const apiUrl = new URL("https://api.project-jam.is-a.dev/api/v0/image/qr");
  apiUrl.searchParams.append("type", "sms");
  apiUrl.searchParams.append("phone", phone);
  apiUrl.searchParams.append("message", message);

  return apiUrl;
}

async function handleTelQR(
  interaction: ChatInputCommandInteraction,
): Promise<URL> {
  const phone = interaction.options.getString("phone", true);

  const apiUrl = new URL("https://api.project-jam.is-a.dev/api/v0/image/qr");
  apiUrl.searchParams.append("type", "tel");
  apiUrl.searchParams.append("phone", phone);

  return apiUrl;
}

async function handleEmailQR(
  interaction: ChatInputCommandInteraction,
): Promise<URL> {
  const email = interaction.options.getString("email", true);
  const subject = interaction.options.getString("subject");
  const body = interaction.options.getString("body");

  const apiUrl = new URL("https://api.project-jam.is-a.dev/api/v0/image/qr");
  apiUrl.searchParams.append("type", "email");
  apiUrl.searchParams.append("email", email);
  if (subject) apiUrl.searchParams.append("subject", subject);
  if (body) apiUrl.searchParams.append("body", body);

  return apiUrl;
}

async function handleVCardQR(
  interaction: ChatInputCommandInteraction,
): Promise<URL> {
  const name = interaction.options.getString("name", true);
  const phone = interaction.options.getString("phone");
  const email = interaction.options.getString("email");
  const url = interaction.options.getString("url");
  const address = interaction.options.getString("address");

  const apiUrl = new URL("https://api.project-jam.is-a.dev/api/v0/image/qr");
  apiUrl.searchParams.append("type", "vcard");
  apiUrl.searchParams.append("name", name);
  if (phone) apiUrl.searchParams.append("phone", phone);
  if (email) apiUrl.searchParams.append("email", email);
  if (url) apiUrl.searchParams.append("url", url);
  if (address) apiUrl.searchParams.append("address", address);

  return apiUrl;
}
