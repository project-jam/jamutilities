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

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Self-nyah transformation case
      if (target?.id === interaction.user.id) {
        const selfMessage = selfNyahMessages[
          Math.floor(Math.random() * selfNyahMessages.length)
        ](interaction.user.toString());

        const [gifUrl] = await Promise.all([getGif("nyah")]);

        const catBorderTop = generateCatBorder();
        const catBorderBottom = generateCatBorder();

        // Generate a chorus of cat sounds
        const catChorus = Array(3)
          .fill("")
          .map(() => getRandomSound())
          .join(" ");

        const embed = new EmbedBuilder()
          .setColor("#FF69B4") // Hot pink for maximum chaos
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
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTimestamp();

        // Add random cat reactions
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Regular nyah case
      const [gifUrl, message] = await Promise.all([
        getGif("nyah"),
        Promise.resolve(
          getRandomMessage(
            nyahMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1") // Light pink for regular nyahs
        .setTitle(`${getRandomCatEmote()} Nyah Time! ${getRandomCatEmote()}`)
        .setDescription(message)
        .setImage(gifUrl)
        .setFooter({
          text: `Tip: /nyah @${interaction.user.username} to unlock your true feline form!`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Nyah command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              `❌ The nyah~ energy was too powerful! ${getRandomCatEmote()} Try again!`,
            ),
        ],
      });
    }
  },
};
