import {
  ChatInputCommandInteraction,
  Message,
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
    .setDescription("Get Duolingo user statistics")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("The Duolingo username to look up")
        .setRequired(true),
    ),

  // Add prefix command configuration
  prefix: {
    aliases: ["duolingo", "duo"],
    usage: "<username>", // Example: jam!duo username
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    // Handle different ways to defer/show typing
    if (isPrefix) {
      await (interaction as Message).channel.sendTyping();
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
    }

    try {
      // Get username from appropriate source
      const username = isPrefix
        ? (interaction as Message).content
            .slice(process.env.PREFIX?.length || 0)
            .trim()
            .split(/ +/g)
            .slice(1)[0]
        : (interaction as ChatInputCommandInteraction).options.getString(
            "username",
            true,
          );

      // Check if username was provided
      if (!username) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Please provide a Duolingo username!")
          .addFields({
            name: "Usage",
            value: isPrefix
              ? `${process.env.PREFIX || "jam!"}duolingo <username>`
              : "/duolingo username:<username>",
          });

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

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
        const notFoundEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ User not found!");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [notFoundEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [notFoundEmbed],
          });
        }
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
        .setColor("#58CC02")
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
            name: "👑 Subscription",
            value: user.hasPlus ? "Super Duolingo / Duolingo Max" : "Free", // Updated to show Super/Max
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

      // Send the embed
      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Failed to fetch Duolingo profile:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Failed to fetch Duolingo profile. Please check the username and try again.",
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
