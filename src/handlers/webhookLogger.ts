// src/utils/webhookLogger.ts
import axios from "axios";

export class WebhookLogger {
    private webhookUrl: string;

    constructor(webhookUrl: string) {
        this.webhookUrl = webhookUrl;
    }

    async sendLog(message: string, level: string) {
        try {
            await axios.post(this.webhookUrl, {
                content: `**[${level}]** ${message}`,
            });
        } catch (error) {
            console.error("Failed to send log to webhook:", error);
        }
    }
}
