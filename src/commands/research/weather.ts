import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface WeatherData {
  temp_F: string;
  temp_C: string;
  feelsLike_F: string;
  feelsLike_C: string;
  humidity: string;
  windspeedMiles: string;
  winddir16Point: string;
  weatherDesc: Array<{ value: string }>;
  maxTemp_F: string;
  minTemp_F: string;
  maxTemp_C: string;
  minTemp_C: string;
  pressure: string;
  pressureInches: string;
  visibilityMiles: string;
  cloudcover: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moonPhase: string;
  moonIllumination: string;
  precipInches: string;
  precipMM: string;
  localObsDateTime: string;
  uvIndex: string;
  location: {
    name: string;
    country: string;
    region: string;
  };
}

// Helper function to get weather condition emoji
function getWeatherEmoji(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes("sun")) return "☀️";
  if (desc.includes("cloud")) return "☁️";
  if (desc.includes("rain")) return "🌧️";
  if (desc.includes("snow")) return "❄️";
  if (desc.includes("thunder")) return "⛈️";
  if (desc.includes("mist") || desc.includes("fog")) return "🌫️";
  if (desc.includes("wind")) return "💨";
  if (desc.includes("clear")) return "🌟";
  return "🌡️";
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Get weather information for a location")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription(
          "Enter the location to fetch the weather for (e.g., 'Detroit')",
        )
        .setRequired(true),
    ),

  prefix: {
    aliases: ["weather", "w", "forecast"],
    usage: "<location>",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let location: string;

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
                .setDescription("❌ Please provide a location!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}weather <location>`,
                    `${process.env.PREFIX || "jam!"}w <location>`,
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}weather Tokyo`,
                    `${process.env.PREFIX || "jam!"}w "New York"`,
                    `${process.env.PREFIX || "jam!"}forecast London`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        location = args.join(" ");
        await message.channel.sendTyping();
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        location = (
          interaction as ChatInputCommandInteraction
        ).options.getString("location", true);
      }

      const response = await fetch(
        `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      );

      if (!response.ok) {
        throw new Error(`Weather API returned ${response.status}`);
      }

      const data = await response.json();
      const currentCondition = data.current_condition[0];
      const weather = data.weather[0];
      const location_data = data.nearest_area[0];

      const locationName = `${location_data.areaName[0].value}, ${location_data.country[0].value}`;
      const weatherDesc = currentCondition.weatherDesc[0].value;
      const weatherEmoji = getWeatherEmoji(weatherDesc);

      const embed = new EmbedBuilder()
        .setColor("#00AE86")
        .setTitle(`${weatherEmoji} Weather in ${locationName}`)
        .setDescription(`**Current Conditions:** ${weatherDesc}`)
        .addFields(
          {
            name: "🌡️ Temperature",
            value: `${currentCondition.temp_C}°C / ${currentCondition.temp_F}°F`,
            inline: true,
          },
          {
            name: "💧 Humidity",
            value: `${currentCondition.humidity}%`,
            inline: true,
          },
          {
            name: "💨 Wind",
            value: `${currentCondition.windspeedMiles} mph (${currentCondition.winddir16Point})`,
            inline: true,
          },
          {
            name: "📊 Today's Range",
            value: `${weather.mintempC}°C to ${weather.maxtempC}°C`,
            inline: true,
          },
          {
            name: "🌅 Sunrise",
            value: weather.astronomy[0].sunrise,
            inline: true,
          },
          {
            name: "🌇 Sunset",
            value: weather.astronomy[0].sunset,
            inline: true,
          },
        )
        .setFooter({
          text: `Data from wttr.in • ${currentCondition.observation_time}`,
          iconURL:
            interaction instanceof Message
              ? interaction.author.displayAvatarURL()
              : interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add precipitation if present
      if (currentCondition.precipMM !== "0.0") {
        embed.addFields({
          name: "🌧️ Precipitation",
          value: `${currentCondition.precipMM}mm`,
          inline: true,
        });
      }

      // Add visibility
      embed.addFields({
        name: "👁️ Visibility",
        value: `${currentCondition.visibility} miles`,
        inline: true,
      });

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Weather command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Failed to fetch weather data. Please check the location name and try again.",
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
