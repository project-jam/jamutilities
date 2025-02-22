import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("time")
    .setDescription(
      "Shows current time or converts time between timezones using timeapi.io",
    )
    // Option for showing current time (default is UTC if not provided)
    .addStringOption((option) =>
      option
        .setName("timezone")
        .setDescription(
          "Timezone to show current time (e.g., UTC, Europe/Paris, etc.)",
        )
        .setRequired(false),
    )
    // Options for time conversion (if both provided, conversion is performed)
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

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const from = interaction.options.getString("from");
    const to = interaction.options.getString("to");

    if (from && to) {
      // Conversion mode
      try {
        // Validate timezone formats
        const validTimezoneRegex = /^[A-Za-z_]+\/[A-Za-z_]+$/;
        if (!validTimezoneRegex.test(from) || !validTimezoneRegex.test(to)) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ Invalid timezone format. Please use format like 'Europe/Paris' or 'America/New_York'",
                ),
            ],
          });
          return;
        }

        // Fetch current time in source timezone
        const responseFrom = await fetch(
          `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(from)}`,
        );

        if (!responseFrom.ok) {
          throw new Error(
            `Error fetching time for source timezone: ${responseFrom.status}`,
          );
        }

        const dataFrom = await responseFrom.json();

        // Format the datetime properly
        const originalDateTime = new Date(dataFrom.dateTime);
        const formattedDateTime = originalDateTime
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        // Use the conversion endpoint
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
          },
        );

        if (!responseConvert.ok) {
          throw new Error(`Error converting time: ${responseConvert.status}`);
        }

        const dataConvert = await responseConvert.json();

        // Create embed with conversion results
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

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        Logger.error("Time conversion failed:", error);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Failed to convert time. Please check the timezone formats and try again.",
              ),
          ],
        });
      }
    } else {
      // Show current time mode
      try {
        const timezone = interaction.options.getString("timezone") || "UTC";
        const response = await fetch(
          `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(timezone)}`,
        );

        if (!response.ok) {
          throw new Error(`Error fetching time: ${response.status}`);
        }

        const data = await response.json();

        // Ensure we have a valid date
        if (!data.dateTime) {
          throw new Error("No datetime received from API");
        }

        const currentTime = new Date(data.dateTime);
        const formattedTime = currentTime.toLocaleString("en-US", {
          timeZone: timezone,
          dateStyle: "full",
          timeStyle: "long",
        });

        const embed = new EmbedBuilder()
          .setTitle(`🕒 Current Time`)
          .setColor("#43b581")
          .addFields(
            {
              name: "Location",
              value: `**${timezone}**`,
              inline: true,
            },
            {
              name: "Current Time",
              value: `**${formattedTime}**`,
              inline: true,
            },
          );

        // Add timezone information if available
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

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        Logger.error("Time command failed:", error);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ Failed to fetch time. Please check the timezone format and try again.",
              ),
          ],
        });
      }
    }
  },
};
