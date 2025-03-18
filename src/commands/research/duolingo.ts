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
  creationDate: number;
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

function getCurrentUTCTime(): string {
  const now = new Date();
  return now.toISOString().replace("T", " ").slice(0, 19);
}

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

  prefix: {
    aliases: ["duolingo", "duo"],
    usage: "<username>",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    const executorName = isPrefix
      ? (interaction as Message).author.tag
      : (interaction as ChatInputCommandInteraction).user.tag;
    const currentTime = getCurrentUTCTime();

    if (isPrefix) {
      await (interaction as Message).channel.sendTyping();
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
    }

    try {
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

      if (!username) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Please provide a Duolingo username!")
          .addFields({
            name: "Usage",
            value: isPrefix
              ? `${process.env.PREFIX || "jam!"}duolingo <username>`
              : "/duolingo username:<username>",
          })
          .setFooter({
            text: `Requested by ${executorName} • ${currentTime} UTC`,
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
          .setDescription("❌ User not found!")
          .setFooter({
            text: `Requested by ${executorName} • ${currentTime} UTC`,
          });

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

      // Format courses information without crowns
      const coursesInfo = user.courses
        .map(
          (course) =>
            `${languageEmojis[course.learningLanguage] || "🌐"} **${
              course.title
            }**\n╰ XP: ${course.xp.toLocaleString()}`,
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
            value: user.hasPlus ? "Super Duolingo / Duolingo Max" : "Free",
            inline: true,
          },
          {
            name: "📚 Learning Languages",
            value: coursesInfo || "No courses found",
          },
        )
        .setFooter({
          text: `Requested by ${executorName} • ${currentTime} UTC`,
        });

      // Add streak information if available
      if (user.streakData?.currentStreak) {
        embed.addFields({
          name: "🗓️ Streak Period",
          value: `Started: ${
            user.streakData.currentStreak.startDate
          }\nProjected End: ${user.streakData.currentStreak.endDate}`,
        });
      }

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
        )
        .setFooter({
          text: `Requested by ${executorName} • ${currentTime} UTC`,
        });

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
