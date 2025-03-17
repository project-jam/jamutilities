import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  version as discordVersion,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("about")
    .setDMPermission(true)
    .setDescription("Shows information about the bot"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const client = interaction.client;

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setAuthor({
        name: client.user?.username || "JamUtilities",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        "JamUtilities is a feature-rich Discord bot focused on bringing fun interactions and moderation tools to your server! ",
      )
      .addFields(
        {
          name: "🤖 Version",
          value: "v2.0.0",
          inline: true,
        },
        {
          name: "📚 Library",
          value: `Discord.js v${discordVersion}`,
          inline: true,
        },
        {
          name: "👥 Serving",
          value: `${client.guilds.cache.size} servers`,
          inline: true,
        },
        {
          name: "🔧 Technologies",
          value: [
            "• TypeScript",
            "• Node.js",
            "• Discord.js",
            "• Bun Runtime",
          ].join("\n"),
          inline: true,
        },
        {
          name: "🎮 Features",
          value: [
            "• Fun Interactions",
            "• Moderation Tools",
            "• Utility Commands",
            "• Server Management",
          ].join("\n"),
          inline: true,
        },
        {
          name: "🔗 Links",
          value: [
            "• [Website](https://project-jam.is-a.dev)",
            "• [GitHub](https://github.com/project-jam/jamutilities)",
          ].join("\n"),
          inline: true,
        },
        {
          name: "💝 Special Thanks",
          value:
            "Thanks to all our users and contributors who make JamUtilities better every day!",
        },
      )
      .setFooter({
        text: "Made with ❤️ by Project Jam, an open source project :)",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
