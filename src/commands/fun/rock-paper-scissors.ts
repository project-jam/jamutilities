import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

const choices = ["rock", "paper", "scissors"];

function determineWinner(userChoice: string, opponentChoice: string): string {
  if (userChoice === opponentChoice) {
    return "It's a tie!";
  } else if (
    (userChoice === "rock" && opponentChoice === "scissors") ||
    (userChoice === "paper" && opponentChoice === "rock") ||
    (userChoice === "scissors" && opponentChoice === "paper")
  ) {
    return "You win!";
  } else {
    return "You lose!";
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rock-paper-scissors")
    .setDescription("Play Rock, Paper, Scissors with another user")
    .addUserOption((option) =>
      option
        .setName("opponent")
        .setDescription("The user to play against")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["rps", "rockpaperscissors"],
    usage: "<@user>",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let opponentUser: string | null = null;
      let opponentId: string | null = null;

      if (isPrefix) {
        const message = interaction as Message;
        const args = message.content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/);

        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please mention a user to play against!"),
            ],
          });
          return;
        }

        opponentUser = mentionedUser.tag;
        opponentId = mentionedUser.id;

        await message.channel.sendTyping();
      } else {
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();

        const mentionedUser = slashInteraction.options.getUser(
          "opponent",
          true,
        );
        opponentUser = mentionedUser.tag;
        opponentId = mentionedUser.id;
      }

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("rock")
          .setLabel("Rock")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("paper")
          .setLabel("Paper")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("scissors")
          .setLabel("Scissors")
          .setStyle(ButtonStyle.Primary),
      );

      const initialEmbed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle("Rock, Paper, Scissors")
        .setDescription(
          `You are playing against ${opponentUser}. Choose your move!`,
        );

      const message = await (isPrefix
        ? (interaction as Message).reply({
            embeds: [initialEmbed],
            components: [buttons],
            fetchReply: true,
          })
        : (interaction as ChatInputCommandInteraction).editReply({
            embeds: [initialEmbed],
            components: [buttons],
          }));

      const collector = (message as Message).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
      });

      let userChoice: string | null = null;
      let opponentChoice: string | null = null;

      collector.on("collect", async (i) => {
        if (
          i.user.id !==
            (isPrefix
              ? (interaction as Message).author.id
              : (interaction as ChatInputCommandInteraction).user.id) &&
          i.user.id !== opponentId
        ) {
          await i.reply({
            content: "❌ These buttons aren't for you!",
            ephemeral: true,
          });
          return;
        }

        if (
          i.user.id ===
          (isPrefix
            ? (interaction as Message).author.id
            : (interaction as ChatInputCommandInteraction).user.id)
        ) {
          userChoice = i.customId;
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle("Rock, Paper, Scissors")
                .setDescription(`Choose your move!`),
            ],
            components: [buttons],
          });
        } else if (i.user.id === opponentId) {
          opponentChoice = i.customId;
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setColor("#2b2d31")
                .setTitle("Rock, Paper, Scissors")
                .setDescription(`Choose your move!`),
            ],
            components: [buttons],
          });
        }

        if (userChoice && opponentChoice) {
          const result = determineWinner(userChoice, opponentChoice);

          const resultEmbed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle("Rock, Paper, Scissors")
            .setDescription(
              `You (${userChoice}) vs ${opponentUser} (${opponentChoice})\n\n${result}`,
            )
            .setFooter({
              text: `Requested by ${isPrefix ? (interaction as Message).author.tag : (interaction as ChatInputCommandInteraction).user.tag}`,
              iconURL: isPrefix
                ? (interaction as Message).author.displayAvatarURL()
                : (
                    interaction as ChatInputCommandInteraction
                  ).user.displayAvatarURL(),
            })
            .setTimestamp();

          await message.edit({ embeds: [resultEmbed], components: [] });
        }
      });

      collector.on("end", () => {
        if (isPrefix) {
          (message as Message).edit({ components: [] }).catch(() => {});
        } else {
          (interaction as ChatInputCommandInteraction)
            .editReply({ components: [] })
            .catch(() => {});
        }
      });
    } catch (error) {
      Logger.error("Rock, Paper, Scissors command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ An error occurred while playing Rock, Paper, Scissors.",
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
