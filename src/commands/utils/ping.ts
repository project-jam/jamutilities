import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDMPermission(true)
    .setDescription("Shows bot latency and API response time"),

  async execute(interaction: ChatInputCommandInteraction) {
    // Start with deferring the reply
    await interaction.deferReply();

    // Calculate different types of latency
    const websocketLatency = interaction.client.ws.ping;
    const startTime = Date.now();

    // Send a test message and measure roundtrip time
    const response = await interaction.editReply("Calculating ping...");
    const endTime = Date.now();

    const roundtripLatency = endTime - interaction.createdTimestamp;
    const apiLatency = endTime - startTime;

    // Get appropriate emoji based on latency
    const getLatencyEmoji = (ms: number) => {
      if (ms <= 100) return "🟢"; // Excellent
      if (ms <= 200) return "🟡"; // Good
      if (ms <= 400) return "🟠"; // Moderate
      return "🔴"; // Poor
    };

    // Function to format latency with color coding
    const formatLatency = (ms: number) => {
      return `${getLatencyEmoji(ms)} \`${ms}ms\``;
    };

    const embed = new EmbedBuilder()
      .setTitle("🏓 Pong!")
      .addFields(
        {
          name: "Roundtrip Latency",
          value: formatLatency(roundtripLatency),
          inline: true,
        },
        {
          name: "API Latency",
          value: formatLatency(apiLatency),
          inline: true,
        },
        {
          name: "WebSocket Latency",
          value: formatLatency(websocketLatency),
          inline: true,
        },
      )
      .setFooter({
        text: "Green: Excellent (≤100ms) | Yellow: Good (≤200ms) | Orange: Moderate (≤400ms) | Red: Poor (>400ms)",
      })
      .setTimestamp()
      .setColor(
        roundtripLatency <= 100
          ? "#43b581" // Green
          : roundtripLatency <= 200
            ? "#faa61a" // Yellow
            : roundtripLatency <= 400
              ? "#f26522" // Orange
              : "#f04747", // Red
      );

    await interaction.editReply({ content: "", embeds: [embed] });
  },
};
