import { promises as fs } from "fs";
import { watch } from "fs";
import { join } from "path";
import { Logger } from "../utils/logger";

interface BlacklistEntry {
  username: string;
  reason: string;
  timestamp: number;
}

export class BlacklistManager {
  private static instance: BlacklistManager;
  private blacklistPath: string;
  private blacklistedUsers: Map<string, BlacklistEntry>;
  private fileWatcher: fs.FSWatcher | null = null;

  private constructor() {
    this.blacklistPath = join(__dirname, "..", "..", "blacklist.env");
    this.blacklistedUsers = new Map();
    this.loadBlacklist();
    this.watchBlacklistFile();
  }

  public static getInstance(): BlacklistManager {
    if (!BlacklistManager.instance) {
      BlacklistManager.instance = new BlacklistManager();
    }
    return BlacklistManager.instance;
  }

  private watchBlacklistFile(): void {
    try {
      this.fileWatcher = watch(
        this.blacklistPath,
        async (eventType, filename) => {
          if (filename) {
            Logger.debug(`Blacklist file changed (${eventType}), reloading...`);
            await this.loadBlacklist();
            Logger.info("Blacklist reloaded successfully");
          }
        },
      );

      Logger.info("Blacklist file watcher started");
    } catch (error) {
      Logger.error("Failed to start blacklist file watcher:", error);
    }
  }

  private async loadBlacklist(): Promise<void> {
    try {
      const data = await fs.readFile(this.blacklistPath, "utf-8");
      Logger.debug(`Loading blacklist data: ${data}`);

      const lines = data.split("\n").filter((line) => line.trim());

      const newBlacklist = new Map<string, BlacklistEntry>();
      lines.forEach((line) => {
        const [id, username, reason] = line
          .split("=")
          .map((part) => part.trim());
        if (id && username && reason) {
          newBlacklist.set(id, {
            username,
            reason,
            timestamp: Date.now(),
          });
          Logger.debug(`Loaded blacklist entry: ${id} - ${username}`);
        }
      });

      this.blacklistedUsers = newBlacklist;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        Logger.info("No blacklist file found, will create when needed");
      } else {
        Logger.error("Error loading blacklist:", error);
      }
    }
  }

  private async saveBlacklist(): Promise<void> {
    try {
      this.fileWatcher?.removeAllListeners();

      const content = Array.from(this.blacklistedUsers.entries())
        .map(([id, entry]) => `${id}=${entry.username}=${entry.reason}`)
        .join("\n");

      await fs.writeFile(this.blacklistPath, content);
      Logger.debug(`Saved blacklist content: ${content}`);

      this.watchBlacklistFile();
    } catch (error) {
      Logger.error("Error saving blacklist:", error);
      throw error;
    }
  }

  public async addUser(
    userId: string,
    username: string,
    reason: string,
  ): Promise<void> {
    try {
      this.blacklistedUsers.set(userId, {
        username,
        reason,
        timestamp: Date.now(),
      });
      await this.saveBlacklist();
      Logger.debug(`Added user to blacklist: ${userId} - ${username}`);
    } catch (error) {
      Logger.error(`Failed to add user to blacklist: ${userId}`, error);
      throw error;
    }
  }

  public async removeUser(userId: string): Promise<boolean> {
    try {
      const removed = this.blacklistedUsers.delete(userId);
      if (removed) {
        await this.saveBlacklist();
        Logger.debug(`Removed user from blacklist: ${userId}`);
      }
      return removed;
    } catch (error) {
      Logger.error(`Failed to remove user from blacklist: ${userId}`, error);
      throw error;
    }
  }

  public async reloadBlacklist(): Promise<void> {
    await this.loadBlacklist();
    Logger.info("Blacklist manually reloaded");
  }

  public searchBlacklist(query: string): Array<[string, BlacklistEntry]> {
    query = query.toLowerCase();
    Logger.debug(`Searching blacklist for query: ${query}`);

    const results = Array.from(this.blacklistedUsers.entries()).filter(
      ([id, entry]) => {
        const matches =
          id.toLowerCase().includes(query) ||
          entry.username.toLowerCase().includes(query) ||
          entry.reason.toLowerCase().includes(query);

        Logger.debug(
          `Checking entry - ID: ${id}, Username: ${entry.username}, Result: ${matches}`,
        );
        return matches;
      },
    );

    Logger.debug(`Search results count: ${results.length}`);
    return results;
  }

  public isBlacklisted(userId: string): boolean {
    return this.blacklistedUsers.has(userId);
  }

  public getBlacklistInfo(userId: string): BlacklistEntry | null {
    return this.blacklistedUsers.get(userId) || null;
  }

  public cleanup(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      Logger.debug("Blacklist file watcher closed");
    }
  }
}
