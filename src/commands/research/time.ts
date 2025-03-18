import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
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
    .setName("time")
    .setDescription(
      "Shows current time or converts time between timezones using timeapi.io",
    )
    .addStringOption((option) =>
      option
        .setName("timezone")
        .setDescription(
          "Timezone to show current time (e.g., UTC, Europe/Paris, etc.)",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("from")
        .setDescription(
          "Source timezone for conversion (e.g., Africa/Casablanca)",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("to")
        .setDescription("Target timezone for conversion (e.g., Europe/Paris)")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["time", "tz", "timezone"],
    usage: "[timezone] [from timezone] [to timezone]",
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
          .split(/ +/g)
          .slice(1);

        await message.channel.sendTyping();

        let timezone, from, to;
        if (args.length === 1) {
          timezone = args[0];
        } else if (args.length === 2) {
          [from, to] = args;
        } else if (args.length === 0) {
          timezone = "UTC";
        } else {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Invalid command usage!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}time [timezone]`,
                    `${process.env.PREFIX || "jam!"}time [from timezone] [to timezone]`,
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}time UTC`,
                    `${process.env.PREFIX || "jam!"}time America/New_York Europe/London`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        await handleTimeCommand(message, timezone, from, to);
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        const timezone = (
          interaction as ChatInputCommandInteraction
        ).options.getString("timezone");
        const from = (
          interaction as ChatInputCommandInteraction
        ).options.getString("from");
        const to = (
          interaction as ChatInputCommandInteraction
        ).options.getString("to");

        await handleTimeCommand(interaction, timezone, from, to);
      }
    } catch (error) {
      Logger.error("Time command execution error:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ An error occurred while processing the command.");

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

async function handleTimeCommand(
  interaction: ChatInputCommandInteraction | Message,
  timezone?: string | null,
  from?: string | null,
  to?: string | null,
) {
  try {
    const fetchOptions = { agent };

    if (from && to) {
      const validTimezoneRegex = /^[A-Za-z_]+\/[A-Za-z_]+$/;
      if (!validTimezoneRegex.test(from) || !validTimezoneRegex.test(to)) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            "❌ Invalid timezone format. Please use format like 'Europe/Paris' or 'America/New_York'",
          );

        if (interaction instanceof Message) {
          await interaction.reply({ embeds: [errorEmbed] });
        } else {
          await interaction.editReply({ embeds: [errorEmbed] });
        }
        return;
      }

      const responseFrom = await fetch(
        `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(from)}`,
        fetchOptions,
      );

      if (!responseFrom.ok) {
        throw new Error(
          `Error fetching time for source timezone: ${responseFrom.status}`,
        );
      }

      const dataFrom = await responseFrom.json();
      const originalDateTime = new Date(dataFrom.dateTime);
      const formattedDateTime = originalDateTime
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      const responseConvert = await fetch(
        "https://timeapi.io/api/conversion/converttimezone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromTimeZone: from,
            toTimeZone: to,
            dateTime: formattedDateTime,
            dstAmbiguity: "",
          }),
          agent,
        },
      );

      if (!responseConvert.ok) {
        throw new Error(`Error converting time: ${responseConvert.status}`);
      }

      const dataConvert = await responseConvert.json();

      const embed = new EmbedBuilder()
        .setTitle("🕒 Time Conversion")
        .setColor("#43b581")
        .addFields(
          {
            name: "Source Time",
            value: `**${from}**\n${formattedDateTime}`,
            inline: true,
          },
          {
            name: "Converted Time",
            value: `**${to}**\n${dataConvert.conversionResult.dateTime}`,
            inline: true,
          },
        )
        .setTimestamp();

      if (interaction instanceof Message) {
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
    } else {
      const tz = timezone || "UTC";
      const response = await fetch(
        `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(tz)}`,
        fetchOptions,
      );

      if (!response.ok) {
        throw new Error(`Error fetching time: ${response.status}`);
      }

      const data = await response.json();

      if (!data.dateTime) {
        throw new Error("No datetime received from API");
      }

      const currentTime = new Date(data.dateTime);
      const formattedTime = currentTime.toLocaleString("en-US", {
        timeZone: tz,
        dateStyle: "full",
        timeStyle: "long",
      });

      const embed = new EmbedBuilder()
        .setTitle(`🕒 Current Time`)
        .setColor("#43b581")
        .addFields(
          {
            name: "Location",
            value: `**${tz}**`,
            inline: true,
          },
          {
            name: "Current Time",
            value: `**${formattedTime}**`,
            inline: true,
          },
        );

      if (data.timeZone) {
        const tzInfo = [];

        if (data.timeZone.name) {
          tzInfo.push(`Name: ${data.timeZone.name}`);
        }

        if (data.timeZone.currentUtcOffset) {
          const offset = data.timeZone.currentUtcOffset;
          const hours = offset.hours || 0;
          const minutes = (offset.minutes || 0).toString().padStart(2, "0");
          const sign = hours >= 0 ? "+" : "";
          tzInfo.push(`UTC Offset: ${sign}${hours}:${minutes}`);
        }

        if (data.timeZone.hasDayLightSavings) {
          tzInfo.push("Observes Daylight Savings");
        }

        if (tzInfo.length > 0) {
          embed.addFields({
            name: "Timezone Information",
            value: tzInfo.join("\n"),
            inline: false,
          });
        }
      }

      embed.setTimestamp();

      if (interaction instanceof Message) {
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
    }
  } catch (error) {
    Logger.error("Time command failed:", error);
    const errorEmbed = new EmbedBuilder()
      .setColor("#ff3838")
      .setDescription(
        "❌ Failed to fetch time. Please check the timezone format and try again.",
      );

    if (interaction instanceof Message) {
      await interaction.reply({ embeds: [errorEmbed] });
    } else {
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
}
