import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

// Classic ridiculous 8 ball responses
const responses = [
  "As I see it, yes... but I also need glasses 👓",
  "Ask again later, I'm watching cat videos 🐱",
  "Better not tell you now (I forgot the answer) 🤔",
  "Cannot predict now, Mercury is being extra backwards ♈",
  "Concentrate and ask again (I wasn't paying attention) 😅",
  "Don't count on it (I'm counting anyway: 1, 2, 3...) 🔢",
  "It is certain! (Maybe) (Not really) (I'm confused) 😵‍💫",
  "It is decidedly so... wait, what was the question? 🤪",
  "Most likely... unless it isn't 🎲",
  "My reply is no... but I'm known for being wrong 🙃",
  "My sources say no (my sources are questionable memes) 🤡",
  "Outlook good! But I said that about the weather too... 🌧️",
  "Reply hazy, try again (or don't, I'm not your boss) 🌫️",
  "Signs point to yes... but they're probably facing the wrong way 🚦",
  "Very doubtful (but I also doubted the Earth was round, so...) 🌍",
  "Without a doubt! *doubts intensify* 📈",
  "Yes – definitely! (This message is sponsored by Yes™) 💫",
  "You may rely on it (but I wouldn't if I were you) 😉",
  "Does a duck quack? (I genuinely don't know, please tell me) 🦆",
  "The stars say yes, but they're just balls of gas so... 🌟",
];

const ballAnimations = ["🎱", "8⃣", "🎱", "8⃣"];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription(
      'Ask the Magic 8 Ball a question and get a totally "reliable" answer!',
    )
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription(
          "What would you like to ask this completely unreliable ball?",
        )
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(256),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString("question", true);
    await interaction.deferReply();

    // Quick animation
    for (const frame of ballAnimations) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#2b2d31")
            .setDescription(`${frame} *shaking ball vigorously*`),
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const response = responses[Math.floor(Math.random() * responses.length)];
    const randomColors = [
      "#ff69b4",
      "#43b581",
      "#faa61a",
      "#f04747",
      "#9b59b6",
      "#3498db",
    ];
    const color = randomColors[Math.floor(Math.random() * randomColors.length)];

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle("🎱 Totally Accurate Magic 8 Ball™")
      .setDescription(
        `**You asked:** ${question}\n**8 Ball says:** ${response}`,
      )
      .setFooter({
        text: "Results may vary. Side effects include confusion and uncontrollable gigg- WAIT WHAT, NO THAT'S NOT WHAT I MEANT FOR!!!",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
