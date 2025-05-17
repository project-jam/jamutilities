// src/utils/logger.ts
import moment from "moment";
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

    static setLevel(level: LogLevel) {
        Logger.level = level;
    }

    private static async sendToWebhook(
        level: LogLevel,
        message: string,
        error?: any,
    ) {
        if (!Logger.webhookLogger) return;
        const embedLevels = new Set<LogLevel>([
            LogLevel.READY,
            LogLevel.FATAL,
            LogLevel.ERROR,
            LogLevel.WARN,
            LogLevel.EVENT,
            LogLevel.INFO,
            LogLevel.COMMAND,
        ]);
        if (embedLevels.has(level)) {
            const payload = error
                ? `${message}\n\nError: ${error.stack || error.message}`
                : message;
            await Logger.webhookLogger.sendLog(payload, level);
        }
    }

    private static formatMessage(
        level: LogLevel,
        message: string,
        error?: any,
    ): string {
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        let content = `[${timestamp}] [${level}] ${message}`;
        if (error) {
            content += `\nError: ${error.stack || error.message}`;
        }

        // Terminal decoration
        const lines = content
            .split("\n")
            .map(
                (line) =>
                    `${BOX.side} ${line.padEnd(BOX.top.length - 4)} ${BOX.side}`,
            );
        return [BOX.top, ...lines, BOX.bottom].join("\n");
    }

    private static stripAnsi(input: string): string {
        return input.replace(/\u001b\[[0-9;]*m/g, "");
    }

    private static async log(level: LogLevel, message: string, error?: any) {
        if (Logger.logLevels[Logger.level] > Logger.logLevels[level]) return;

        const decorated = Logger.formatMessage(level, message, error);
        if (level === LogLevel.ERROR || level === LogLevel.FATAL)
            console.error(decorated);
        else console.log(decorated);

        await Logger.sendToWebhook(level, message, error);
    }

    static debug(message: string) {
        return Logger.log(LogLevel.DEBUG, message);
    }

    static info(message: string) {
        return Logger.log(LogLevel.INFO, message);
    }

    static warn(message: string) {
        return Logger.log(LogLevel.WARN, message);
    }

    static error(message: string, error?: any) {
        return Logger.log(LogLevel.ERROR, message, error);
    }

    static fatal(message: string, error?: any) {
        return Logger.log(LogLevel.FATAL, message, error).then(() =>
            process.exit(1),
        );
    }

    static command(message: string) {
        return Logger.log(LogLevel.COMMAND, message);
    }

    static event(message: string) {
        return Logger.log(LogLevel.EVENT, message);
    }

    static success(message: string) {
        return Logger.log(LogLevel.READY, `✨ ${message}`);
    }

    static startupBanner(botName: string, version: string) {
        const msg = `✨ ${botName} v${version} ready to go!`;
        return Logger.log(LogLevel.READY, msg);
    }

    static ready(title: string, messages: string[]) {
        const combined = `${title}\n${messages.join("\n")}`;
        return Logger.log(LogLevel.READY, combined);
    }
}

Logger.setLevel(LogLevel.DEBUG);
export { LogLevel };
