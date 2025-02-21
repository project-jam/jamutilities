import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface DuolingoUser {
  username: string;
  name: string;
  streak: number;
  totalXp: number;
  learningLanguage: string;
  fromLanguage: string;
  courses: {
    title: string;
    learningLanguage: string;
    fromLanguage: string;
    xp: number;
    crowns: number;
  }[];
  streakData: {
    currentStreak: {
      startDate: string;
      length: number;
      endDate: string;
    };
  };
  hasPlus: boolean;
  picture: string;
}

interface DuolingoResponse {
  users: DuolingoUser[];
}

const languageEmojis: { [key: string]: string } = {
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  ja: "🇯🇵",
  ko: "🇰🇷",
  zh: "🇨🇳",
  ru: "🇷🇺",
  pt: "🇵🇹",
  nl: "🇳🇱",
  tr: "🇹🇷",
  pl: "🇵🇱",
  ar: "🇸🇦",
  hi: "🇮🇳",
  cs: "🇨🇿",
  sv: "🇸🇪",
  vi: "🇻🇳",
  da: "🇩🇰",
  el: "🇬🇷",
  fi: "🇫🇮",
  hu: "🇭🇺",
  id: "🇮🇩",
  ro: "🇷🇴",
  th: "🇹🇭",
  uk: "🇺🇦",
  he: "🇮🇱",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("duolingo")
    .setDescription("Get Duolingo (rip) user statistics")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("The Duolingo username to look up")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const username = interaction.options.getString("username", true);
      const response = await fetch(
        `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(
          username,
        )}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as DuolingoResponse;

      if (!data.users || data.users.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ User not found!"),
          ],
        });
        return;
      }

      const user = data.users[0];

      // Format courses information
      const coursesInfo = user.courses
        .map(
          (course) =>
            `${languageEmojis[course.learningLanguage] || "🌐"} **${
              course.title
            }**\n╰ XP: ${course.xp.toLocaleString()} | Crowns: ${course.crowns.toLocaleString()}`,
        )
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor("#58CC02") // Duolingo's green color
        .setTitle(`${user.name || user.username}'s Duolingo Profile`)
        .setURL(`https://www.duolingo.com/profile/${user.username}`)
        .setThumbnail(
          user.picture.startsWith("//")
            ? `https:${user.picture}`
            : user.picture,
        )
        .addFields(
          {
            name: "🔥 Current Streak",
            value: `${user.streak} days`,
            inline: true,
          },
          {
            name: "⭐ Total XP",
            value: user.totalXp.toLocaleString(),
            inline: true,
          },
          {
            name: "👑 Duolingo Plus",
            value: user.hasPlus ? "Yes" : "No",
            inline: true,
          },
          {
            name: "📚 Learning Languages",
            value: coursesInfo || "No courses found",
          },
        )
        .setFooter({
          text: `Joined Duolingo: ${new Date(
            user.creationDate * 1000,
          ).toLocaleDateString()}`,
        })
        .setTimestamp();

      // Add streak information if available
      if (user.streakData?.currentStreak) {
        embed.addFields({
          name: "🗓️ Streak Period",
          value: `Started: ${
            user.streakData.currentStreak.startDate
          }\nProjected End: ${user.streakData.currentStreak.endDate}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Failed to fetch Duolingo profile:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to fetch Duolingo profile. Please check the username and try again.",
            ),
        ],
      });
    }
  },
};
