// src/utils/webhookLogger.ts
import axios from "axios";

export class WebhookLogger {
    private webhookUrl: string;

    constructor(webhookUrl: string) {
        this.webhookUrl = webhookUrl;
    }

    async sendLog(message: string, level: string) {
        try {
            const colorMap: Record<string, number> = {
                DEBUG: 0x808080,
                INFO: 0x0000ff,
                WARN: 0xffff00,
                ERROR: 0xff0000,
                FATAL: 0x8b0000,
                COMMAND: 0xff00ff,
                EVENT: 0x00ffff,
                READY: 0x00ff00,
            };
            const titleMap: Record<string, string> = {
                DEBUG: "Debug",
                INFO: "Info",
                WARN: "Warn",
                ERROR: "Error",
                FATAL: "Fatal",
                COMMAND: "Command",
                EVENT: "Event",
                READY: "Ready!",
            };
            const embedTitle = titleMap[level] || level;
            const embed = {
                title: embedTitle,
                description: message,
                timestamp: new Date().toISOString(),
                color: colorMap[level] ?? 0xffffff,
            };

            await axios.post(this.webhookUrl, { embeds: [embed] });
        } catch (error) {
            console.error("Failed to send log to webhook:", error);
        }
    }
}
