import {
  ChatInputCommandInteraction,
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
  cooldown: 3, // 3 seconds cooldown

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldownAmount = (this.cooldown || 3) * 1000; // Convert to milliseconds

    // Check if user is on cooldown
    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId)! + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(`⏰ Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    cooldowns.set(userId, now);
    setTimeout(() => cooldowns.delete(userId), cooldownAmount);

    await interaction.deferReply();

    try {
      const query = interaction.options.getString("query", true);
      const detailed = interaction.options.getBoolean("detailed") ?? false;

      // Fetch search results from Wikipedia API
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srprop=snippet&origin=*`;
      const searchResponse = await fetch(searchUrl);
      const searchData: WikiSearchResponse = await searchResponse.json();

      if (!searchData.query.search.length) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ No results found for your search."),
          ],
        });
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
        .setDescription(detailed ? cleanExtract.substring(0, 4096) : cleanExtract.substring(0, 256) + "...")
        .addFields({
          name: "Read More",
          value: `[Click here to read the full article](${pageData.fullurl})`,
        })
        .setFooter({
          text: `Requested by ${interaction.user.tag} | Data from Wikipedia`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add thumbnail if available and valid
      if (pageData.pageimage) {
        try {
          // Ensure the image URL is fully qualified
          let thumbnailUrl = pageData.pageimage;
          if (!thumbnailUrl.startsWith('http')) {
            thumbnailUrl = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(thumbnailUrl)}`;
          }

          const url = new URL(thumbnailUrl);
          embed.setThumbnail(url.toString());
        } catch (error) {
          console.warn('Invalid thumbnail URL:', pageData.pageimage);
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

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Wikipedia command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ An error occurred while searching Wikipedia."),
        ],
      });
    }
  },
};

