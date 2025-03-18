import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Cat-themed emoticons
const catEmotes = [
  "(=^･ω･^=)",
  "(^･o･^)ﾉ",
  "(=｀ω´=)",
  "₍⸍⸌̣ʷ̣̫⸍̣⸌₎",
  "(=^･^=)",
  "≋≋≋≋≋̯̫⌧̯̫(=˃ᆺ˂)",
  "(^≗ω≗^)",
  "ᓚᘏᗢ",
  "(๑ↀᆺↀ๑)",
  "( =ω=)..nyaa",
  "(・∀・)",
  "(ฅ`ω´ฅ)",
  "~(=^‥^)ノ",
  "(=^-ω-^=)",
  "(=^･ｪ･^=))ﾉ彡☆",
  "^ↀᴥↀ^",
];

// Cat sounds for variety
const catSounds = [
  "nyah~",
  "meow!",
  "purr~",
  "mrrp!",
  "nya!",
  "mrow~",
  "prrrr~",
  "mew!",
  "nyaa~",
  "*purrrrrr*",
  "mrrrrow!",
  "nyan~",
  "*happy cat noises*",
  "meow meow!",
  "nyanya~",
];

// Regular nyah messages
const nyahMessages = [
  (user: string, target: string) =>
    `**${user}** nyahs at **${target}**! ${getRandomCatEmote()} ${getRandomSound()}`,
  (user: string, target: string) =>
    `**${user}** shares catperson energy with **${target}**! ${getRandomCatEmote()} ${getRandomSound()}`,
  (user: string, target: string) =>
    `**${target}** gets infected with nyah~ from **${user}**! ${getRandomCatEmote()} ${getRandomSound()}`,
  (user: string, target: string) =>
    `**${user}** spreads the cat agenda to **${target}**! ${getRandomCatEmote()} ${getRandomSound()}`,
  (user: string, target: string) =>
    `**${user}** awakens **${target}**'s inner feline! ${getRandomCatEmote()} ${getRandomSound()}`,
  (user: string, target: string) =>
    `**${target}** gets caught in **${user}**'s nyah~ field! ${getRandomCatEmote()} ${getRandomSound()}`,
];

// Chaotic self-nyah transformations
const selfNyahMessages = [
  (user: string) =>
    `🐱 **${user}** achieves MAXIMUM NYAH! Reality collapses into cats! ${getRandomCatEmote()}`,
  (user: string) =>
    `🌟 **${user}** transcends humanity and becomes a being of pure nyah~ ${getRandomCatEmote()}`,
  (user: string) =>
    `✨ ALERT: **${user}** has created a nyah~ singularity! ${getRandomCatEmote()}`,
  (user: string) =>
    `🎭 **${user}** unlocks all nine lives simultaneously! ${getRandomCatEmote()}`,
  (user: string) =>
    `🌈 The prophecy is fulfilled! **${user}** becomes the LEGENDARY NYAH! ${getRandomCatEmote()}`,
  (user: string) =>
    `⚡ **${user}** discovers they were a cat all along! Plot twist! ${getRandomCatEmote()}`,
  (user: string) =>
    `🔮 **${user}** causes a chain reaction of infinite nyahs! ${getRandomCatEmote()}`,
  (user: string) =>
    `🎪 Breaking news: **${user}** has mastered the forbidden nyah technique! ${getRandomCatEmote()}`,
];

// Helper functions for random elements
function getRandomCatEmote(): string {
  return catEmotes[Math.floor(Math.random() * catEmotes.length)];
}

function getRandomSound(): string {
  return catSounds[Math.floor(Math.random() * catSounds.length)];
}

// Generates a cat-themed border
function generateCatBorder(): string {
  return Array(3)
    .fill("")
    .map(() => getRandomCatEmote())
    .join(" ");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nyah")
    .setDescription("Embrace your inner catperson! (=^･ω･^=)")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to nyah at")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["nyah", "nya", "meow"],
    usage: "<@user>", // Example: jam!nyah @user
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
                  `❌ Please mention someone to nyah at! ${getRandomCatEmote()} ${getRandomSound()}`,
                )
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <@user>`)
                    .concat("Example: `jam!nyah @user`")
                    .join("\n"),
                }),
            ],
          });
          return;
        }
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        target = (interaction as ChatInputCommandInteraction).options.getUser(
          "user",
        );
      }

      // Self-nyah transformation case
      if (target.id === user.id) {
        const selfMessage = selfNyahMessages[
          Math.floor(Math.random() * selfNyahMessages.length)
        ](user.toString());

        const gifUrl = await getGif("nyah");
        const catBorderTop = generateCatBorder();
        const catBorderBottom = generateCatBorder();
        const catChorus = Array(3)
          .fill("")
          .map(() => getRandomSound())
          .join(" ");

        const embed = new EmbedBuilder()
          .setColor("#FF69B4")
          .setTitle(`${catBorderTop} NYAH TRANSFORMATION ${catBorderTop}`)
          .setDescription(
            [
              selfMessage,
              "",
              catChorus,
              "",
              `${catBorderBottom} ๑ᕙ(^∀^)ᕗ ${catBorderBottom}`,
            ].join("\n"),
          )
          .setImage(gifUrl)
          .setFooter({
            text: "Side effects may include: sudden cat ear growth, unexpected purring, and dimensional instability",
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
        return;
      }

      // Regular nyah case
      const gifUrl = await getGif("nyah");
      const message = getRandomMessage(
        nyahMessages,
        user.toString(),
        target.toString(),
      );

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1")
        .setTitle(`${getRandomCatEmote()} Nyah Time! ${getRandomCatEmote()}`)
        .setDescription(message)
        .setImage(gifUrl)
        .setFooter({
          text: `Tip: Try ${isPrefix ? "jam!" : "/"}nyah ${isPrefix ? "@" : ""}${user.username} to unlock your true feline form!`,
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
      Logger.error("Nyah command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ The nyah~ energy was too powerful! ${getRandomCatEmote()} Try again!`,
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
