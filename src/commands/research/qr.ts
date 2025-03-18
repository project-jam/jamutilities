import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("qr")
    .setDescription("Generate QR codes")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("basic")
        .setDescription("Generate basic QR code")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("The text to encode in the QR code")
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

  prefix: {
    aliases: ["qr", "qrcode", "qgen"],
    usage: "<basic/wifi/sms/tel/email/vcard> [options]",
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
          .split(/ +/);
        args.shift(); // Remove command name

        if (args.length === 0) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide a subcommand!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}qr <subcommand> [options]`,
                    "",
                    "Available Subcommands:",
                    "• basic - Generate basic QR code",
                    "• wifi - Generate WiFi QR code (sent via DM)",
                    "• sms - Generate SMS QR code (sent via DM)",
                    "• tel - Generate phone QR code (sent via DM)",
                    "• email - Generate email QR code (sent via DM)",
                    "• vcard - Generate vCard QR code",
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        const subcommand = args[0].toLowerCase();
        const sensitiveCommands = ["wifi", "sms", "tel", "email"];
        const isSensitive = sensitiveCommands.includes(subcommand);

        if (isSensitive && message.guild) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#2b2d31")
                .setDescription("🔒 Check your DMs for the QR code!"),
            ],
          });
        }

        const apiUrl = new URL(
          "https://api.project-jam.is-a.dev/api/v0/image/qr",
        );

        switch (subcommand) {
          case "basic": {
            if (args.length < 2) {
              await message.reply("Please provide text for the QR code!");
              return;
            }
            const text = args.slice(1).join(" ");
            apiUrl.searchParams.append("text", text);
            break;
          }
          case "wifi": {
            if (args.length < 4) {
              await message.reply(
                "Please provide SSID, password, and encryption type!",
              );
              return;
            }
            apiUrl.searchParams.append("type", "wifi");
            apiUrl.searchParams.append("ssid", args[1]);
            apiUrl.searchParams.append("password", args[2]);
            apiUrl.searchParams.append("encryption", args[3]);
            apiUrl.searchParams.append(
              "hidden",
              (args[4] === "true").toString(),
            );
            break;
          }
          case "sms": {
            if (args.length < 3) {
              await message.reply("Please provide phone number and message!");
              return;
            }
            apiUrl.searchParams.append("type", "sms");
            apiUrl.searchParams.append("phone", args[1]);
            apiUrl.searchParams.append("message", args.slice(2).join(" "));
            break;
          }
          case "tel": {
            if (args.length < 2) {
              await message.reply("Please provide a phone number!");
              return;
            }
            apiUrl.searchParams.append("type", "tel");
            apiUrl.searchParams.append("phone", args[1]);
            break;
          }
          case "email": {
            if (args.length < 2) {
              await message.reply("Please provide an email address!");
              return;
            }
            apiUrl.searchParams.append("type", "email");
            apiUrl.searchParams.append("email", args[1]);
            if (args[2]) apiUrl.searchParams.append("subject", args[2]);
            if (args[3])
              apiUrl.searchParams.append("body", args.slice(3).join(" "));
            break;
          }
          case "vcard": {
            if (args.length < 2) {
              await message.reply("Please provide at least a name!");
              return;
            }
            apiUrl.searchParams.append("type", "vcard");
            apiUrl.searchParams.append("name", args[1]);
            if (args[2]) apiUrl.searchParams.append("phone", args[2]);
            if (args[3]) apiUrl.searchParams.append("email", args[3]);
            if (args[4]) apiUrl.searchParams.append("url", args[4]);
            if (args[5])
              apiUrl.searchParams.append("address", args.slice(5).join(" "));
            break;
          }
          default:
            await message.reply(
              "Invalid subcommand! Use: basic, wifi, sms, tel, email, or vcard",
            );
            return;
        }

        const response = await fetch(apiUrl.toString());
        if (!response.ok) throw new Error(`API returned ${response.status}`);

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const attachment = new AttachmentBuilder(imageBuffer, {
          name: `qr-${subcommand}.png`,
        });

        const embed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle(`🔐 ${subcommand.toUpperCase()} QR Code`)
          .setDescription(`Type: ${subcommand}`)
          .setImage(`attachment://qr-${subcommand}.png`)
          .setTimestamp()
          .setFooter({
            text: `Requested by ${message.author.tag}`,
            iconURL: message.author.displayAvatarURL(),
          });

        if (isSensitive) {
          try {
            await message.author.send({ embeds: [embed], files: [attachment] });
          } catch (error) {
            await message.reply(
              "❌ Couldn't send you a DM! Please check your privacy settings.",
            );
          }
        } else {
          await message.reply({ embeds: [embed], files: [attachment] });
        }
      } else {
        // Original slash command logic
        await (interaction as ChatInputCommandInteraction).deferReply({
          ephemeral: interaction.options.getSubcommand() !== "basic",
        });

        const subcommand = (
          interaction as ChatInputCommandInteraction
        ).options.getSubcommand();

        const apiUrl = new URL(
          "https://api.project-jam.is-a.dev/api/v0/image/qr",
        );

        // Set QR code parameters based on subcommand
        switch (subcommand) {
          case "basic": {
            const text = (
              interaction as ChatInputCommandInteraction
            ).options.getString("text", true);
            const size =
              (interaction as ChatInputCommandInteraction).options.getNumber(
                "size",
              ) || 400;
            const margin =
              (interaction as ChatInputCommandInteraction).options.getNumber(
                "margin",
              ) || 4;
            const dark =
              (interaction as ChatInputCommandInteraction).options.getString(
                "dark",
              ) || "000000";
            const light =
              (interaction as ChatInputCommandInteraction).options.getString(
                "light",
              ) || "FFFFFF";
            const logo = (
              interaction as ChatInputCommandInteraction
            ).options.getString("logo");

            apiUrl.searchParams.append("text", text);
            apiUrl.searchParams.append("size", size.toString());
            apiUrl.searchParams.append("margin", margin.toString());
            apiUrl.searchParams.append("dark", dark);
            apiUrl.searchParams.append("light", light);
            if (logo) apiUrl.searchParams.append("logo", logo);
            break;
          }
          case "wifi": {
            const ssid = (
              interaction as ChatInputCommandInteraction
            ).options.getString("ssid", true);
            const password = (
              interaction as ChatInputCommandInteraction
            ).options.getString("password", true);
            const encryption = (
              interaction as ChatInputCommandInteraction
            ).options.getString("encryption", true);
            const hidden =
              (interaction as ChatInputCommandInteraction).options.getBoolean(
                "hidden",
              ) || false;

            apiUrl.searchParams.append("type", "wifi");
            apiUrl.searchParams.append("ssid", ssid);
            apiUrl.searchParams.append("password", password);
            apiUrl.searchParams.append("encryption", encryption);
            apiUrl.searchParams.append("hidden", hidden.toString());
            break;
          }
          // Add similar cases for other subcommands
          // Following the same pattern
        }

        const response = await fetch(apiUrl.toString());
        if (!response.ok)
          throw new Error(`API returned status ${response.status}`);

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const attachment = new AttachmentBuilder(imageBuffer, {
          name: `qr-${subcommand}.png`,
        });

        const embed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle("📌 QR Code Generated")
          .setDescription(`Type: ${subcommand}`)
          .setImage(`attachment://qr-${subcommand}.png`)
          .setTimestamp()
          .setFooter({
            text: `Requested by ${
              (interaction as ChatInputCommandInteraction).user.tag
            }`,
            iconURL: (
              interaction as ChatInputCommandInteraction
            ).user.displayAvatarURL(),
          });

        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
          files: [attachment],
        });
      }
    } catch (error) {
      Logger.error("QR code command failed:", error);
      const errorMessage = {
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to generate QR code. Please try again later.",
            ),
        ],
      };

      if (isPrefix) {
        await (interaction as Message).reply(errorMessage);
      } else {
        await (interaction as ChatInputCommandInteraction).editReply(
          errorMessage,
        );
      }
    }
  },
};
