import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/Command";
import { getAverageColor } from "fast-average-color-node";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("emoji")
    .setDescription("Generate a mix of two emojis in an embed")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mix")
        .setDescription("Mix two emojis into an emoji image")
        .addStringOption((option) =>
          option.setName("emoji1").setDescription("The first emoji to mix").setRequired(true),
        )
        .addStringOption((option) =>
          option.setName("emoji2").setDescription("The second emoji to mix").setRequired(true),
        ),
    ),

  prefix: {
    aliases: ["emojimix", "mixemoji", "emix"],
    usage: "<emoji1> <emoji2>", // Example: jam!emix 😀 😎
  },

  async execute(interaction: ChatInputCommandInteraction | Message, isPrefix = false) {
    let emoji1: string;
    let emoji2: string;

    if (isPrefix) {
      const message = interaction as Message;
      await message.channel.sendTyping();
      const args = message.content.trim().split(/ +/).slice(1);

      if (args.length !== 2) {
        const prefix = process.env.PREFIX || "jam!";
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Please provide exactly two emojis to mix!")
              .addFields({
                name: "Usage",
                value: command.prefix.aliases
                  .map((alias) => `${prefix}${alias} <emoji1> <emoji2>`)
                  .concat("Example: `jam!emix 😀 😎`")
                  .join("\n"),
              }),
          ],
        });
        return;
      }
      [emoji1, emoji2] = args;
    } else {
      const slashInteraction = interaction as ChatInputCommandInteraction;
      await slashInteraction.deferReply();
      emoji1 = slashInteraction.options.getString("emoji1", true);
      emoji2 = slashInteraction.options.getString("emoji2", true);
    }

    try {
      const emojiRegex =
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}]/u;
      
      if (!emoji1.match(emojiRegex) || !emoji2.match(emojiRegex)) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Please provide valid emojis!");
        
        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }
      
      const encodedEmoji1 = encodeURIComponent(emoji1);
      const encodedEmoji2 = encodeURIComponent(emoji2);
      const url = `https://emojik.vercel.app/s/${encodedEmoji1}_${encodedEmoji2}?size=1024`;
      
      const color = await getAverageColor(url);
      
      const embed = new EmbedBuilder()
        .setTitle(`${emoji1} + ${emoji2}`)
        .setImage(url)
        .setColor(color.hex)
        .setTimestamp();
      
      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      Logger.error("Error mixing emojis:", errorMessage);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(`❌ Something went wrong: \`${errorMessage}\`. Please try again.`);
      
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
