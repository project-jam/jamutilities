import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Command } from "../../types/Command";
import { getWeather, WeatherData } from "../../utils/weather";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Get the current weather information for a specified location")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("Enter the location to fetch the weather for (e.g., 'Detroit')")
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const location = interaction.options.getString("location", true);

    try {
      // Fetch the weather data using the weather handler
      const weatherData: WeatherData = await getWeather(location);

      // Check if the weatherDesc array exists and has a value
      const weatherCondition = weatherData.weatherDesc && weatherData.weatherDesc[0]?.value
        ? weatherData.weatherDesc[0].value
        : "No description available";

      // Create the weather embed with detailed fields (no moon data)
      const embed = new EmbedBuilder()
        .setColor("#1E90FF") // Adjust the color if needed
        .setTitle(`🌦️ Weather in ${location}`)
        .setDescription(`**Current conditions** at ${weatherData.localObsDateTime || 'N/A'}`)
        .addFields(
          { name: "🌡️ Temperature", value: `${weatherData.temp_F}°F / ${weatherData.temp_C}°C`, inline: true },
          { name: "Max Temperature", value: `${weatherData.maxTemp_F}°F / ${weatherData.maxTemp_C}°C`, inline: true },
          { name: "Min Temperature", value: `${weatherData.minTemp_F}°F / ${weatherData.minTemp_C}°C`, inline: true },
          { name: "💧 Humidity", value: `${weatherData.humidity}%`, inline: true },
          { name: "🌬️ Wind Speed", value: `${weatherData.windspeedMiles} mph (${weatherData.winddir16Point})`, inline: true },
          { name: "🌫️ Visibility", value: `${weatherData.visibilityMiles} miles`, inline: true },
          { name: "💨 Wind Direction", value: `${weatherData.winddir16Point}`, inline: true },
          { name: "☁️ Condition", value: weatherCondition, inline: false },
          { name: "🌧️ Precipitation", value: `${weatherData.precipInches} inches / ${weatherData.precipMM} mm`, inline: true },
          { name: "🌅 Sunrise", value: weatherData.sunrise || "Data unavailable", inline: true },
          { name: "🌇 Sunset", value: weatherData.sunset || "Data unavailable", inline: true },
        )
        .setFooter({ text: `Data fetched at ${new Date().toLocaleTimeString()}` });

      // Send the embed to the user
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      // Handle error if fetching weather data fails
      await interaction.reply({ content: "Failed to fetch weather data. Please try again later.", ephemeral: true });
    }
  },
};

