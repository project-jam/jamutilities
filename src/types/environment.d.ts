declare global {
    namespace NodeJS {
        interface ProcessEnv {
            DISCORD_TOKEN: string;
            CLIENT_ID: string;
            OWNER_ID: string;
            DISABLED_COMMANDS?: string;
            IGNORED_USER_ID: string;
            PREFIX?: string;
            ENABLE_PREFIX_COMMANDS?: string;
            ENABLE_SLASH_COMMANDS?: string;
            CHUTES_API_TOKEN?: string;
            CHUTES_MODEL?: string;
        }
    }
}

export {};
