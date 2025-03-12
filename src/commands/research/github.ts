import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string;
  topics: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  license?: {
    name: string;
    url: string;
  };
}

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  company: string | null;
  email: string | null;
  hireable: boolean | null;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("github")
    .setDescription("Get information about GitHub repositories and users")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("repo")
        .setDescription("Get information about a GitHub repository")
        .addStringOption((option) =>
          option
            .setName("repository")
            .setDescription('Repository name (e.g., "username/repository")')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("user")
        .setDescription("Get information about a GitHub user")
        .addStringOption((option) =>
          option
            .setName("username")
            .setDescription("GitHub username")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "repo":
          await handleRepoLookup(interaction);
          break;
        case "user":
          await handleUserLookup(interaction);
          break;
      }
    } catch (error) {
      Logger.error("GitHub command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ An error occurred while fetching GitHub information.",
            ),
        ],
      });
    }
  },
};

async function handleRepoLookup(interaction: ChatInputCommandInteraction) {
  const repo = interaction.options.getString("repository", true);

  if (!repo.includes("/")) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            '❌ Please provide the repository in the format "username/repository"',
          ),
      ],
    });
    return;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Discord-Bot",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Repository not found!"),
        ],
      });
      return;
    }
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data: GitHubRepo = await response.json();

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(data.full_name)
    .setURL(data.html_url)
    .setDescription(data.description || "No description provided")
    .setThumbnail(data.owner.avatar_url)
    .addFields(
      {
        name: "📊 Statistics",
        value: [
          `⭐ Stars: ${data.stargazers_count.toLocaleString()}`,
          `🔀 Forks: ${data.forks_count.toLocaleString()}`,
          `⚠️ Issues: ${data.open_issues_count.toLocaleString()}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "💻 Details",
        value: [
          `📝 Language: ${data.language || "Not specified"}`,
          `🌿 Default Branch: ${data.default_branch}`,
          `📜 License: ${data.license?.name || "Not specified"}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "⏰ Timestamps",
        value: [
          `Created: <t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`,
          `Updated: <t:${Math.floor(new Date(data.updated_at).getTime() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
    )
    .setFooter({
      text: `Owner: ${data.owner.login}`,
      iconURL: data.owner.avatar_url,
    })
    .setTimestamp();

  if (data.topics && data.topics.length > 0) {
    embed.addFields({
      name: "🏷️ Topics",
      value: data.topics.map((topic) => `\`${topic}\``).join(", "),
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleUserLookup(interaction: ChatInputCommandInteraction) {
  const username = interaction.options.getString("username", true);

  const response = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Discord-Bot",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ User not found!"),
        ],
      });
      return;
    }
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data: GitHubUser = await response.json();

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(data.name || data.login)
    .setURL(data.html_url)
    .setDescription(data.bio || "No bio provided")
    .setThumbnail(data.avatar_url)
    .addFields(
      {
        name: "📊 Statistics",
        value: [
          `📚 Repositories: ${data.public_repos.toLocaleString()}`,
          `📝 Gists: ${data.public_gists.toLocaleString()}`,
          `👥 Followers: ${data.followers.toLocaleString()}`,
          `👤 Following: ${data.following.toLocaleString()}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "📌 Profile",
        value:
          [
            data.company ? `🏢 ${data.company}` : null,
            data.location ? `📍 ${data.location}` : null,
            data.email ? `📧 ${data.email}` : null,
            data.blog ? `🌐 [Website](${data.blog})` : null,
            data.twitter_username
              ? `🐦 [@${data.twitter_username}](https://twitter.com/${data.twitter_username})`
              : null,
            data.hireable ? "✅ Available for hire" : null,
          ]
            .filter(Boolean)
            .join("\n") || "No additional information provided",
        inline: true,
      },
      {
        name: "⏰ Timestamps",
        value: [
          `Joined: <t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`,
          `Updated: <t:${Math.floor(new Date(data.updated_at).getTime() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
    )
    .setFooter({
      text: `GitHub User: ${data.login}`,
      iconURL: data.avatar_url,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
