import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  Collection,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

// Cooldown collection
const cooldowns = new Collection<string, number>();

interface WikiSearchResponse {
  query: {
    search: {
      title: string;
      snippet: string;
      pageid: number;
    }[];
  };
}

interface WikiExtractResponse {
  query: {
    pages: {
      [key: string]: {
        extract: string;
        fullurl: string;
        pageimage?: string;
      };
    };
  };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("wikipedia")
    .setDescription("Search Wikipedia articles")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("What would you like to search for?")
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("detailed")
        .setDescription("Show a more detailed result?")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["wikipedia", "wiki", "wp"],
    usage: "<query> [--detailed]",
  },

  cooldown: 3, // 3 seconds cooldown

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    const userId = isPrefix
      ? (interaction as Message).author.id
      : (interaction as ChatInputCommandInteraction).user.id;
    const now = Date.now();
    const cooldownAmount = (this.cooldown || 3) * 1000;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId)! + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `⏰ Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`,
          );

        if (isPrefix) {
          await (interaction as Message).reply({
            embeds: [errorEmbed],
            ephemeral: true,
          });
        } else {
          await (interaction as ChatInputCommandInteraction).reply({
            embeds: [errorEmbed],
            ephemeral: true,
          });
        }
        return;
      }
    }

    cooldowns.set(userId, now);
    setTimeout(() => cooldowns.delete(userId), cooldownAmount);

    try {
      let query: string;
      let detailed = false;
      const commandUsed = isPrefix
        ? (interaction as Message).content
            .slice(process.env.PREFIX?.length || 0)
            .trim()
            .split(/ +/)[0]
        : "wikipedia";

      if (isPrefix) {
        const message = interaction as Message;
        const args = message.content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/);

        args.shift(); // Remove command name

        if (args.length === 0) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide a search query!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}${commandUsed} <query> [--detailed]`,
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}${commandUsed} Discord`,
                    `${process.env.PREFIX || "jam!"}${commandUsed} "Albert Einstein" --detailed`,
                    "",
                    "Options:",
                    "--detailed: Show a more detailed result with similar articles",
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        detailed = args.includes("--detailed");
        query = args.filter((arg) => arg !== "--detailed").join(" ");

        await message.channel.sendTyping();
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        query = (interaction as ChatInputCommandInteraction).options.getString(
          "query",
          true,
        );
        detailed =
          (interaction as ChatInputCommandInteraction).options.getBoolean(
            "detailed",
          ) ?? false;
      }

      // Fetch search results from Wikipedia API
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srprop=snippet&origin=*`;
      const searchResponse = await fetch(searchUrl);
      const searchData: WikiSearchResponse = await searchResponse.json();

      if (!searchData.query.search.length) {
        const notFoundEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(`❌ No results found for "${query}"`);

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [notFoundEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [notFoundEmbed],
          });
        }
        return;
      }

      const firstResult = searchData.query.search[0];

      // Fetch detailed page data
      const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info|pageimages&exintro=true&inprop=url&format=json&pithumbsize=1024&pageids=${firstResult.pageid}&origin=*`;
      const extractResponse = await fetch(extractUrl);
      const extractData: WikiExtractResponse = await extractResponse.json();
      const pageData = extractData.query.pages[firstResult.pageid];

      // Clean up HTML tags from the extract
      const cleanExtract = pageData.extract
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // Build embed for response
      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setTitle(firstResult.title)
        .setURL(pageData.fullurl)
        .setDescription(
          detailed
            ? cleanExtract.substring(0, 4096)
            : cleanExtract.substring(0, 256) + "...",
        )
        .addFields({
          name: "Read More",
          value: `[Click here to read the full article](${pageData.fullurl})`,
        })
        .setFooter({
          text: `Requested by ${isPrefix ? (interaction as Message).author.tag : (interaction as ChatInputCommandInteraction).user.tag}`,
          iconURL: isPrefix
            ? (interaction as Message).author.displayAvatarURL()
            : (
                interaction as ChatInputCommandInteraction
              ).user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add thumbnail if available
      if (pageData.pageimage) {
        try {
          let thumbnailUrl = pageData.pageimage;
          if (!thumbnailUrl.startsWith("http")) {
            thumbnailUrl = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(thumbnailUrl)}`;
          }

          const url = new URL(thumbnailUrl);
          embed.setThumbnail(url.toString());
        } catch (error) {
          Logger.warn("Invalid thumbnail URL:", pageData.pageimage);
        }
      }

      // If detailed view is enabled, include similar articles
      if (detailed && searchData.query.search.length > 1) {
        const similarArticles = searchData.query.search
          .slice(1, 4)
          .map(
            (article, index) =>
              `${index + 1}. [${article.title}](https://en.wikipedia.org/?curid=${article.pageid})`,
          )
          .join("\n");

        embed.addFields({
          name: "Similar Articles",
          value: similarArticles,
        });
      }

      // Add search statistics
      embed.addFields({
        name: "Search Statistics",
        value: `📊 Found ${searchData.query.search.length.toLocaleString()} results`,
        inline: true,
      });

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Wikipedia command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ An error occurred while searching Wikipedia.");

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
