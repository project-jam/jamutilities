// src/utils/logger.ts
import chalk from "chalk";
import moment from "moment";
import gradient from "gradient-string";
import { WebhookLogger } from "../handlers/webhookLogger";

enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    FATAL = "FATAL",
    COMMAND = "COMMAND",
    EVENT = "EVENT",
    READY = "READY",
}

const BOX = {
    top: "╔════════════════════════════════════════════════════╗",
    bottom: "╚════════════════════════════════════════════════════╝",
    side: "║",
    separator: "╠════════════════════════════════════════════════════╣",
};

export class Logger {
    private static logLevels = {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 1,
        [LogLevel.WARN]: 2,
        [LogLevel.ERROR]: 3,
        [LogLevel.FATAL]: 4,
        [LogLevel.COMMAND]: 1,
        [LogLevel.EVENT]: 1,
        [LogLevel.READY]: 1,
    };

    private static level: LogLevel = LogLevel.INFO;
    private static webhookLogger: WebhookLogger | null = null;

    static setWebhook(webhookUrl: string) {
        Logger.webhookLogger = new WebhookLogger(webhookUrl);
    }

    private static async sendToWebhook(
        level: string,
        message: string,
        error?: any,
    ) {
        if (Logger.webhookLogger) {
            const formattedMessage = Logger.formatMessage(
                level,
                message,
                error,
            );
            await Logger.webhookLogger.sendLog(formattedMessage, level);
        }
    }

    private static formatMessage(
        level: string,
        message: string,
        error?: any,
    ): string {
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        let output = `${BOX.side} [${timestamp}] `;

        switch (level) {
            case LogLevel.DEBUG:
                output += chalk.gray(`[${level}] ${message}`);
                break;
            case LogLevel.INFO:
                output += chalk.blue(`[${level}] ${message}`);
                break;
            case LogLevel.WARN:
                output += chalk.yellow(`[${level}] ${message}`);
                break;
            case LogLevel.ERROR:
                output += chalk.red(`[${level}] ${message}`);
                break;
            case LogLevel.FATAL:
                output += chalk.bgRed.white(`[${level}] ${message}`);
                break;
            case LogLevel.COMMAND:
                output += chalk.magenta(`[${level}] 🎮 ${message}`);
                break;
            case LogLevel.EVENT:
                output += chalk.cyan(`[${level}] ${message}`);
                break;
            case LogLevel.READY:
                output += chalk.green(`[${level}] ${message}`);
                break;
        }

        output = output.padEnd(BOX.top.length - 2) + BOX.side;

        if (error) {
            const errorMessage =
                `${BOX.side} ${chalk.red(error.stack || error.message)}`.padEnd(
                    BOX.top.length - 2,
                ) + BOX.side;
            return `${BOX.top}\n${output}\n${BOX.separator}\n${errorMessage}\n${BOX.bottom}`;
        }

        return `${BOX.top}\n${output}\n${BOX.bottom}`;
    }

    static setLevel(level: LogLevel) {
        Logger.level = level;
    }

    static async debug(message: string) {
        if (
            Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.DEBUG]
        ) {
            console.log(Logger.formatMessage(LogLevel.DEBUG, message));
            await Logger.sendToWebhook(LogLevel.DEBUG, message);
        }
    }

    static async info(message: string) {
        if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.INFO]) {
            console.log(Logger.formatMessage(LogLevel.INFO, message));
            await Logger.sendToWebhook(LogLevel.INFO, message);
        }
    }

    static async warn(message: string) {
        if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.WARN]) {
            console.log(Logger.formatMessage(LogLevel.WARN, message));
            await Logger.sendToWebhook(LogLevel.WARN, message);
        }
    }

    static async error(message: string, error?: any) {
        if (
            Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.ERROR]
        ) {
            console.error(Logger.formatMessage(LogLevel.ERROR, message, error));
            await Logger.sendToWebhook(LogLevel.ERROR, message, error);
        }
    }

    static async fatal(message: string, error?: any) {
        if (
            Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.FATAL]
        ) {
            console.error(Logger.formatMessage(LogLevel.FATAL, message, error));
            await Logger.sendToWebhook(LogLevel.FATAL, message, error);
            process.exit(1);
        }
    }

    static async command(message: string) {
        if (
            Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.COMMAND]
        ) {
            console.log(Logger.formatMessage(LogLevel.COMMAND, message));
            await Logger.sendToWebhook(LogLevel.COMMAND, message);
        }
    }

    static async event(message: string) {
        if (
            Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.EVENT]
        ) {
            console.log(Logger.formatMessage(LogLevel.EVENT, message));
            await Logger.sendToWebhook(LogLevel.EVENT, message);
        }
    }

    static async success(message: string) {
        if (Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.INFO]) {
            console.log(Logger.formatMessage(LogLevel.READY, `✨ ${message}`));
            await Logger.sendToWebhook(LogLevel.READY, `✨ ${message}`);
        }
    }

    static async ready(title: string, messages: string[]) {
        if (
            Logger.logLevels[Logger.level] <= Logger.logLevels[LogLevel.READY]
        ) {
            const paddedLength = BOX.top.length - 2;
            const centeredTitle = title
                .padStart((paddedLength + title.length) / 2)
                .padEnd(paddedLength);

            console.log(gradient.pastel(BOX.top));
            console.log(
                gradient.passion(`${BOX.side} ${centeredTitle} ${BOX.side}`),
            );
            console.log(gradient.pastel(BOX.separator));

            messages.forEach((msg) => {
                const paddedMsg = msg.padEnd(paddedLength);
                console.log(
                    gradient.passion(`${BOX.side} ${paddedMsg} ${BOX.side}`),
                );
            });

            console.log(gradient.pastel(BOX.bottom));

            await Logger.sendToWebhook(
                LogLevel.READY,
                title,
                messages.join("\n"),
            );
        }
    }

    static async startupBanner(botName: string, version: string) {
        const banner = [
            `${botName} v${version}`,
            "Created by Project Jam",
            "Now with 100% more chaos!",
            "════════════════════════",
            "Cmon! Hit me with your best shot!",
        ];

        await Logger.ready("STARTUP", banner);
    }
}

Logger.setLevel(LogLevel.DEBUG);

export { LogLevel };
