import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { evaluate, round, parse } from "mathjs"; // Using mathjs for safe evaluation and parsing

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("calculator")
        .setDescription("Evaluates a mathematical expression.")
        .addStringOption((option) =>
            option
                .setName("expression")
                .setDescription(
                    "The mathematical expression to evaluate (e.g., 2 + 2 * 10 / 5)",
                )
                .setRequired(true),
        )
        .addBooleanOption((option) =>
            option
                .setName("render_input_as_image")
                .setDescription(
                    "Render the input expression as a LaTeX image (e.g., for formulas)",
                )
                .setRequired(false),
        ),
    prefix: {
        aliases: ["calculator", "calc", "math"],
        usage: "<mathematical_expression> [--tex to render input as image]\nOr use dedicated alias: texcalc <expression>",
        examples: [
            "calc 2+2*10/5",
            "calc sqrt(16) + sin(pi/2) --tex",
            "texcalc (a+b)^2 = a^2 + 2ab + b^2",
        ],
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let expression: string | null = null;
        let renderAsImage = false;
        const author = isPrefix
            ? (interaction as Message).author
            : interaction.user;

        try {
            if (isPrefix) {
                const msg = interaction as Message;
                const prefixStr = process.env.PREFIX || "jam!";
                let contentWithoutPrefix = msg.content
                    .slice(prefixStr.length)
                    .trim();
                const commandParts = contentWithoutPrefix.split(/ +/);
                const aliasUsed = commandParts.shift()?.toLowerCase();

                expression = commandParts.join(" ");

                if (aliasUsed === "texcalc") {
                    renderAsImage = true;
                } else if (expression.includes("--tex")) {
                    renderAsImage = true;
                    expression = expression.replace(/--tex/g, "").trim();
                }

                if (!expression) {
                    const usageEmbed = new EmbedBuilder()
                        .setColor("#ffcc00")
                        .setTitle("Calculator Usage")
                        .setDescription(
                            `Please provide a mathematical expression.\n**Usage:** \`${prefixStr}${this.prefix!.aliases[0]} ${this.prefix!.usage}\`\n**Examples:**\n${this.prefix!.examples!.map((ex) => `\`${prefixStr}${ex}\``).join("\n")}`,
                        );
                    return msg.reply({ embeds: [usageEmbed] });
                }
            } else {
                await (interaction as ChatInputCommandInteraction).deferReply();
                expression = (
                    interaction as ChatInputCommandInteraction
                ).options.getString("expression", true);
                renderAsImage =
                    (
                        interaction as ChatInputCommandInteraction
                    ).options.getBoolean("render_input_as_image") ?? false;
            }

            if (!expression) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription("No expression provided!");
                if (isPrefix)
                    return (interaction as Message).reply({
                        embeds: [errorEmbed],
                    });
                return (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [errorEmbed],
                });
            }

            const sanitizedExpression = expression.replace(/`/g, "");
            if (sanitizedExpression.length > 256) {
                const errorEmbed = new EmbedBuilder()
                    .setColor("#ff3838")
                    .setDescription(
                        "Expression is too long (max 256 characters).",
                    );
                if (isPrefix)
                    return (interaction as Message).reply({
                        embeds: [errorEmbed],
                    });
                return (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [errorEmbed],
                });
            }

            let result;
            let evaluationError = false;

            try {
                result = evaluate(sanitizedExpression);
            } catch (evalError: any) {
                evaluationError = true;
                Logger.warn(
                    `Calculator evaluation error for expression "${sanitizedExpression}" by ${author.id}: ${evalError.message}`,
                );
                result = evalError.message || "Invalid expression";
            }

            let resultString = "";
            if (evaluationError) {
                resultString = result;
            } else if (typeof result === "number") {
                resultString = round(result, 10).toString();
            } else if (typeof result === "function") {
                resultString = "[Function defined by input]";
            } else if (result === undefined || result === null) {
                resultString = "No result (undefined/null)";
            } else {
                resultString = result.toString();
            }

            if (resultString.length > 1000) {
                resultString = resultString.substring(0, 997) + "...";
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(evaluationError ? "#ff3838" : "#5865F2")
                .setTitle(
                    evaluationError
                        ? "🧮 Calculation Error"
                        : "🧮 Calculator Result",
                )
                .addFields({
                    name: "Input Expression",
                    value: `\`\`\`${expression.substring(0, 1000)}\`\`\``,
                })
                .setFooter({
                    text: `Requested by ${author.tag}`,
                    iconURL: author.displayAvatarURL(),
                })
                .setTimestamp();

            if (evaluationError) {
                resultEmbed.addFields({
                    name: "Error Details",
                    value: `\`\`\`${resultString}\`\`\``,
                });
            } else {
                resultEmbed.addFields({
                    name: "Result",
                    value: `\`\`\`${resultString}\`\`\``,
                });
            }

            if (renderAsImage && sanitizedExpression) {
                try {
                    const parsedExpressionNode = parse(sanitizedExpression);
                    const texInput = parsedExpressionNode.toTex();
                    const texOutput = !evaluationError
                        ? ` = ${resultString}`
                        : "";

                    const fullTex = `\\huge \\dpi{300} \\bg{white} ${texInput}${texOutput}`;
                    const latexImageUrl = `https://latex.codecogs.com/png.image?${encodeURIComponent(
                        fullTex,
                    )}`;

                    resultEmbed.setImage(latexImageUrl);
                } catch (texError: any) {
                    Logger.warn(
                        `Failed to parse/convert to TeX for calculator: \"${sanitizedExpression}\": ${texError.message}`,
                    );
                }
            }

            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [resultEmbed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [resultEmbed],
                });
            }
        } catch (error: any) {
            Logger.error("Calculator command failed:", error);
            const errorEmbed = new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                    "❌ An unexpected error occurred while calculating.",
                );

            if (isPrefix && interaction.channel) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else if (
                !isPrefix &&
                ((interaction as ChatInputCommandInteraction).replied ||
                    (interaction as ChatInputCommandInteraction).deferred)
            ) {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [errorEmbed],
                });
            } else if (!isPrefix) {
                await (interaction as ChatInputCommandInteraction).reply({
                    embeds: [errorEmbed],
                    ephemeral: true,
                });
            }
        }
    },
};
