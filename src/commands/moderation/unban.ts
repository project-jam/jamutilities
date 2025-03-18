import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user from the server")
    .addStringOption((option) =>
      option
        .setName("userid")
        .setDescription("The ID of the user to unban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("The reason for the unban"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  prefix: {
    aliases: ["unban", "pardon"],
    usage: "<userId> [reason]", // Example: jam!unban 123456789 reformed
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let userId;
      let reason = "No reason provided";
      let guild;
      let executor;

      if (isPrefix) {
        const message = interaction as Message;
        guild = message.guild;
        executor = message.member;

        // Check permissions
        if (!message.member?.permissions.has(PermissionFlagsBits.BanMembers)) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ You don't have permission to unban members!",
                ),
            ],
          });
          return;
        }

        const args = message.content.split(/ +/).slice(1);

        if (args.length < 1) {
          const prefix = process.env.PREFIX || "jam!";
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide a user ID to unban!")
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <userId> [reason]`)
                    .concat("Example: `jam!unban 123456789 reformed`")
                    .join("\n"),
                }),
            ],
          });
          return;
        }

        userId = args[0];
        if (args.length > 1) {
          reason = args.slice(1).join(" ");
        }
      } else {
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();
        guild = slashInteraction.guild;
        executor = slashInteraction.member;
        userId = slashInteraction.options.getString("userid", true);
        reason =
          slashInteraction.options.getString("reason") || "No reason provided";
      }

      // Check if the ID is valid
      if (!/^\d{17,19}$/.test(userId)) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            "❌ Please provide a valid user ID! User IDs are 17-19 digit numbers.",
          );

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Fetch ban info
      const banList = await guild?.bans.fetch();
      const banInfo = banList?.find((ban) => ban.user.id === userId);

      if (!banInfo) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ This user is not banned from this server!");

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Format the unban reason
      const executorTag = isPrefix
        ? (interaction as Message).author.tag
        : (interaction as ChatInputCommandInteraction).user.tag;
      const executorId = isPrefix
        ? (interaction as Message).author.id
        : (interaction as ChatInputCommandInteraction).user.id;
      const formattedReason = `Unbanned by ${executorTag} (${executorId}) | ${new Date().toLocaleString()} | Reason: ${reason}`;

      // Perform the unban
      await guild?.members.unban(userId, formattedReason);

      // Create success embed
      const unbanEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("🔓 User Unbanned")
        .setDescription(`Successfully unbanned **${banInfo.user.tag}**`)
        .addFields(
          {
            name: "Unbanned User",
            value: `${banInfo.user.tag} (${banInfo.user.id})`,
            inline: true,
          },
          { name: "Unbanned By", value: executorTag, inline: true },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [unbanEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [unbanEmbed],
        });
      }

      // Try to DM the unbanned user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("You've Been Unbanned")
          .setDescription(`You have been unbanned from ${guild?.name}`)
          .addFields(
            { name: "Unbanned By", value: executorTag },
            { name: "Reason", value: reason },
          )
          .setTimestamp();

        await banInfo.user.send({ embeds: [dmEmbed] });
      } catch (error) {
        Logger.warn(`Could not DM unbanned user ${banInfo.user.tag}`);
      }
    } catch (error) {
      Logger.error("Unban command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ An error occurred while trying to unban the user.");

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
