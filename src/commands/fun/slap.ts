import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Impact decorative elements
const slapDecorations = [
  "👋",
  "💢",
  "💥",
  "⚡",
  "🌟",
  "✨",
  "💫",
  "❗",
  "❕",
  "‼️",
  "⁉️",
  "💪",
  "🎯",
  "🔥",
  "💨",
  "💭",
  "🌪️",
  "🌀",
  "💯",
  "☄️",
];

// Impact kaomoji
const slapKaomoji = [
  "(╯°□°)╯",
  "(ﾉ≧∇≦)ﾉ",
  "(ノಠ益ಠ)ノ",
  "(ﾉ`Д´)ﾉ",
  "(҂` ﾛ ´)凸",
  "( >д<)",
  "(-_- )ﾉ⌒┫ ┻ ┣ ┳",
  "╰( ͡° ͜ʖ ͡° )つ──☆*:・ﾟ",
  "(ノ｀Д´)ノ",
  "(｀∧´)",
  "(っ•﹏•)っ",
  "(ﾉ°益°)ﾉ",
];

// Enhanced slap messages with more impact
const slapMessages = [
  (user: string, target: string) =>
    `**${user}** delivers a legendary slap to **${target}**!`,
  (user: string, target: string) =>
    `**${user}** unleashes the ultimate wake-up slap on **${target}**!`,
  (user: string, target: string) =>
    `CRITICAL HIT! **${user}** slaps **${target}** into next week!`,
  (user: string, target: string) =>
    `**${user}** activates their special move: MEGA SLAP on **${target}**!`,
  (user: string, target: string) =>
    `Watch out **${target}**! **${user}** just used SUPER EFFECTIVE SLAP!`,
  (user: string, target: string) =>
    `**${user}** delivers divine judgment via slap to **${target}**!`,
  (user: string, target: string) =>
    `BOOM! **${user}** slaps **${target}** into another dimension!`,
  (user: string, target: string) =>
    `**${user}** initiates emergency wake-up protocol on **${target}**!`,
  (user: string, target: string) =>
    `**${target}** faces the legendary slap technique of **${user}**!`,
  (user: string, target: string) =>
    `**${user}** uses SLAP ATTACK! It's super effective on **${target}**!`,
];

// Helper functions for random elements
function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => slapDecorations[Math.floor(Math.random() * slapDecorations.length)],
    )
    .join(" ");
}

function getRandomKaomoji(): string {
  return slapKaomoji[Math.floor(Math.random() * slapKaomoji.length)];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slap")
    .setDescription("Unleash the ultimate slap! (╯°□°)╯")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Your slap target")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["slap", "smack", "whack"],
    usage: "<@user>", // Example: jam!slap @user
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let target;
      const user = isPrefix
        ? (interaction as Message).author
        : (interaction as ChatInputCommandInteraction).user;

      if (isPrefix) {
        const message = interaction as Message;
        await message.channel.sendTyping();
        target = message.mentions.users.first();

        if (!target) {
          const prefix = process.env.PREFIX || "jam!";
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  `❌ Please mention someone to slap! ${getRandomKaomoji()}`,
                )
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <@user>`)
                    .concat("Example: `jam!slap @user`")
                    .join("\n"),
                }),
            ],
          });
          return;
        }
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        target = (interaction as ChatInputCommandInteraction).options.getUser(
          "target",
        );
      }

      // Check if target is the ignored user ID
      if (target?.id === process.env.IGNORED_USER_ID) {
        if (isPrefix) {
          await (interaction as Message).reply("ignore her");
        } else {
          await (interaction as ChatInputCommandInteraction).editReply(
            "ignore her",
          );
        }
        return;
      }

      // Don't allow slapping yourself
      if (target.id === user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `❌ Self-slap? That's not how this works! ${getRandomKaomoji()}`,
          )
          .setFooter({
            text: "Find someone else to slap! 👋",
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

      const gifUrl = await getGif("slap");
      const message = getRandomMessage(
        slapMessages,
        user.toString(),
        target.toString(),
      );

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#FF4444")
        .setTitle(`${topDecorations} ULTIMATE SLAP! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Critical hit confirmed! ${getRandomKaomoji()}`,
          iconURL: user.displayAvatarURL(),
        })
        .setTimestamp();

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Slap command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ Your slap missed! They're too powerful! ${getRandomKaomoji()}`,
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
