import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDMPermission(true)
    .setDescription(
      "Play Rock Paper Scissors against the bot or another user using buttons",
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to play against")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("bot")
        .setDescription("Play against the bot")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["rps", "rockpaperscissors"],
    usage: "<@user> or bot=true",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    const user = isPrefix
      ? (interaction as Message).author
      : (interaction as ChatInputCommandInteraction).user;

    // For prefix commands, we need to manually parse the user or bot options from the message content
    let opponent;
    let isBot = false;

    if (isPrefix) {
      const args = (interaction as Message).content.split(" ");

      // Check if a user is mentioned
      const mentionedUser =
        args[1] && args[1].startsWith("<@") && args[1].endsWith(">")
          ? args[1].slice(2, -1)
          : null;
      if (mentionedUser) {
        opponent = await (interaction as Message).guild?.members.fetch(
          mentionedUser,
        );
      } else if (args[1] === "bot=true") {
        isBot = true;
      }
    } else {
      opponent = interaction.options.getUser("user");
      isBot = interaction.options.getBoolean("bot") || false;
    }

    // Create the initial embed prompting the user to make a choice.
    const initialEmbed = new EmbedBuilder()
      .setTitle("Rock Paper Scissors")
      .setDescription("Choose your move by clicking one of the buttons below!")
      .setColor("#faa61a")
      .setTimestamp();

    // Create buttons for Rock, Paper, and Scissors.
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("rps_rock")
        .setLabel("Rock")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("rps_paper")
        .setLabel("Paper")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("rps_scissors")
        .setLabel("Scissors")
        .setStyle(ButtonStyle.Primary),
    );

    let initialMessage: Message;
    if (isPrefix) {
      initialMessage = await (interaction as Message).channel.send({
        embeds: [initialEmbed],
        components: [row],
      });
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
      initialMessage = (await (
        interaction as ChatInputCommandInteraction
      ).editReply({
        embeds: [initialEmbed],
        components: [row],
      })) as Message;
    }

    // Create a collector to handle button clicks.
    const collector = initialMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000, // collector runs for 15 seconds
      filter: (btnInteraction) => btnInteraction.user.id === user.id,
    });

    collector.on("collect", async (btnInteraction) => {
      // Get the user's choice from the customId.
      const userChoice = btnInteraction.customId.replace("rps_", "");
      const validChoices = ["rock", "paper", "scissors"];
      if (!validChoices.includes(userChoice)) return;

      // Handle opponent logic (user vs bot or user vs user)
      if (isBot) {
        // Play against the bot
        const botChoice =
          validChoices[Math.floor(Math.random() * validChoices.length)];
        handleGameResult(userChoice, botChoice, row, btnInteraction);
      } else if (opponent) {
        // Play against another user
        await btnInteraction.update({
          content: "Waiting for your opponent to choose...",
        });

        // Prompt the second player (opponent) to choose Rock, Paper, or Scissors.
        const opponentEmbed = new EmbedBuilder()
          .setTitle("Rock Paper Scissors - Opponent's Turn")
          .setDescription("Please choose your move: Rock, Paper, or Scissors!")
          .setColor("#faa61a");

        // Send the opponent a DM to choose their move.
        const opponentMessage = await opponent.send({
          embeds: [opponentEmbed],
          components: [row],
        });

        // Create a collector for the second user to make their choice
        const opponentChoiceCollector =
          opponentMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 15000,
            filter: (btnInteraction) => btnInteraction.user.id === opponent.id,
          });

        opponentChoiceCollector.on("collect", async (btnInteraction) => {
          const opponentChoice = btnInteraction.customId.replace("rps_", "");

          if (!validChoices.includes(opponentChoice)) return;

          // Handle the game result after both players have chosen
          handleGameResult(userChoice, opponentChoice, row, btnInteraction);

          opponentChoiceCollector.stop();
        });

        opponentChoiceCollector.on("end", async (collected) => {
          if (collected.size === 0) {
            await opponentMessage.edit({
              content:
                "Your opponent took too long to respond. Please try again!",
              components: [],
            });
          }
        });
      }
    });

    // Function to handle the game result
    async function handleGameResult(
      userChoice: string,
      opponentChoice: string,
      row: ActionRowBuilder<ButtonBuilder>,
      btnInteraction: any,
    ) {
      // Determine the outcome.
      let result: string;
      if (userChoice === opponentChoice) {
        result = "It's a tie!";
      } else if (
        (userChoice === "rock" && opponentChoice === "scissors") ||
        (userChoice === "paper" && opponentChoice === "rock") ||
        (userChoice === "scissors" && opponentChoice === "paper")
      ) {
        result = "You win!";
      } else {
        result = "You lose!";
      }

      // Build a result embed.
      const resultEmbed = new EmbedBuilder()
        .setTitle("Rock Paper Scissors")
        .addFields(
          {
            name: "Your Choice",
            value: userChoice.charAt(0).toUpperCase() + userChoice.slice(1),
            inline: true,
          },
          {
            name: "Opponent's Choice",
            value:
              opponentChoice.charAt(0).toUpperCase() + opponentChoice.slice(1),
            inline: true,
          },
          {
            name: "Result",
            value: result,
            inline: false,
          },
        )
        .setTimestamp()
        .setColor(
          result === "You win!"
            ? "#43b581"
            : result === "You lose!"
              ? "#f04747"
              : "#faa61a",
        );

      // Disable the buttons after a selection is made.
      row.components.forEach((button) => button.setDisabled(true));

      // Update the message with the result embed and disabled buttons.
      await btnInteraction.update({
        embeds: [resultEmbed],
        components: [row],
      });
    }

    // If the user doesn't respond within the time limit, disable the buttons.
    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        row.components.forEach((button) => button.setDisabled(true));
        if (isPrefix) {
          await (interaction as Message).edit({
            components: [row],
          });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            components: [row],
          });
        }
      }
    });
  },
};
