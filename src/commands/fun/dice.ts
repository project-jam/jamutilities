import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll multiple dice!")
    .setDMPermission(true)
    .addNumberOption((option) =>
      option
        .setName("quantity")
        .setDescription("Number of dice to roll (9, 18, 27, or 36)")
        .setRequired(true)
        .addChoices(
          { name: "9 dice", value: 9 },
          { name: "18 dice", value: 18 },
          { name: "27 dice", value: 27 },
          { name: "36 dice", value: 36 },
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const quantity = interaction.options.getNumber("quantity", true);
    const results: number[] = [];
    let total = 0;

    // Roll the dice
    for (let i = 0; i < quantity; i++) {
      const roll = Math.floor(Math.random() * 6) + 1;
      results.push(roll);
      total += roll;
    }

    // Create a visual representation of the dice
    const diceEmojis = {
      1: "⚀",
      2: "⚁",
      3: "⚂",
      4: "⚃",
      5: "⚄",
      6: "⚅",
    };

    const visualDice = results
      .map((num) => diceEmojis[num as keyof typeof diceEmojis])
      .join(" ");
    const average = (total / quantity).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor("#4CAF50")
      .setTitle(`🎲 Rolling ${quantity} Dice`)
      .setDescription(visualDice)
      .addFields(
        { name: "Total", value: total.toString(), inline: true },
        { name: "Average", value: average.toString(), inline: true },
      )
      .setFooter({ text: `Rolled by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
