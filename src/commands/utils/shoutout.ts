import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Interaction,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shoutout")
    .setDMPermission(true)
    .setDescription("Give a shoutout to everyone who worked on this bot"),

  prefix: {
    aliases: ["shoutout"],
    usage: "jam!shoutout",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    // Define pages for shoutout
    const pages = [
      {
        title: "Profane Detect Package",
        description: "some of our helpers to the profane detect package :333",
        fields: [
          { name: "skylosrahhh", value: "bad words contributor (at least she knows what json means...), tester & reporter", inline: false },
          { name: "omarplayz.", value: "contributor to the repository & solver of the algorithm", inline: false },
          { name: "slivery0659 or silver", value: "tester & reporter", inline: false },
        ],
      },
      {
        title: "JamUtilities Contributors",
        description: "here are some key contributors, and so much more",
        fields: [
          { name: "founddave", value: "idea & ai trainer :3333 (im not open sourcing that)", inline: false },
          { name: "omarplayz.", value: "creator of the bot", inline: false },
          { name: "formalsnake", value: "supporter & tester", inline: false },
          { name: "ryangamin", value: "hoster 24/7 (thx :3)", inline: false },
        ],
      },
      {
        title: "JamEngine Contributors (coming soon :333)",
        description: "here are some contributors to the upcoming jamengine",
        fields: [
          { name: "ghost58_", value: "3D modelist for testing purposes or for introduction :3", inline: false },
          { name: "omarplayz.", value: "contributor to the project (lol)", inline: false },
        ],
      },
    ];

    let pageIndex = 0;
    const pageCount = pages.length;

    // Build embed for current page
    const buildEmbed = () => {
      const page = pages[pageIndex];
      const embed = new EmbedBuilder()
        .setTitle(page.title)
        .setDescription(page.description)
        .setColor("#0099ff")
        .setFooter({ text: `Page ${pageIndex + 1}/${pageCount}` })
        .setTimestamp();
      if (page.fields.length) {
        embed.addFields(...page.fields);
      }
      return embed;
    };

    // Build Prev/Next buttons
    const buildRow = () =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === pageCount - 1)
      );

    // Send initial message
    let replyMsg: Message;
    if (isPrefix) {
      replyMsg = await (interaction as Message).reply({
        embeds: [buildEmbed()],
        components: [buildRow()],
      });
    } else {
      await (interaction as ChatInputCommandInteraction).deferReply();
      replyMsg = (await (interaction as ChatInputCommandInteraction).editReply({
        embeds: [buildEmbed()],
        components: [buildRow()],
      })) as Message;
    }

    // Collector for button interactions
    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000, // 2 minutes
    });

    collector.on("collect", async (btnInt: Interaction) => {
      if (!btnInt.isButton()) return;
      const userId = isPrefix
        ? (interaction as Message).author.id
        : (interaction as ChatInputCommandInteraction).user.id;
      if (btnInt.user.id !== userId) {
        return btnInt.reply({ content: "These buttons aren’t for you!", ephemeral: true });
      }

      // Update page index
      if (btnInt.customId === "prev_page" && pageIndex > 0) pageIndex--;
      else if (btnInt.customId === "next_page" && pageIndex < pageCount - 1) pageIndex++;

      // Update embed and buttons
      await btnInt.update({ embeds: [buildEmbed()], components: [buildRow()] });
    });

    collector.on("end", async () => {
      // Disable buttons after timeout
      await replyMsg.edit({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("prev_page")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("next_page")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          ),
        ],
      });
    });
  },
};

