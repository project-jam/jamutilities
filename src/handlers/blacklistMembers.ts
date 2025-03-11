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
    this.startFileWatcher();
  }

  public static getInstance(): BlacklistManager {
    if (!BlacklistManager.instance) {
      BlacklistManager.instance = new BlacklistManager();
    }
    return BlacklistManager.instance;
  }

  private startFileWatcher(): void {
    try {
      this.fileWatcher = watch(
        this.blacklistPath,
        async (eventType, filename) => {
          if (filename) {
            await this.loadBlacklist();
          }
        },
      );
    } catch (error) {
      Logger.error("Failed to start blacklist file watcher:", error);
    }
  }

  private async loadBlacklist(): Promise<void> {
    try {
      const data = await fs.readFile(this.blacklistPath, "utf-8");
      const lines = data.split("\n").filter((line) => line.trim());

      const newBlacklist = new Map<string, BlacklistEntry>();

      for (const line of lines) {
        const [id, username, reason, dateString] = line
          .split("=")
          .map((part) => part.trim());

        if (id && username && reason && dateString) {
          // Keep the current timestamp instead of trying to parse the date
          const currentEntry = this.blacklistedUsers.get(id);
          if (currentEntry) {
            // If entry exists, keep its timestamp
            newBlacklist.set(id, {
              username,
              reason,
              timestamp: currentEntry.timestamp,
            });
          } else {
            // If it's a new entry, use current time
            newBlacklist.set(id, {
              username,
              reason,
              timestamp: Math.floor(Date.now() / 1000),
            });
          }
        }
      }

      this.blacklistedUsers = newBlacklist;
      Logger.info(`Loaded ${this.blacklistedUsers.size} blacklist entries`);
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
        .map(([id, entry]) => {
          const date = new Date(entry.timestamp * 1000);
          const formatted = `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}/${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
          return `${id}=${entry.username}=${entry.reason}=${formatted}`;
        })
        .join("\n");

      await fs.writeFile(this.blacklistPath, content);
      this.startFileWatcher();
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
      const timestamp = Math.floor(Date.now() / 1000);
      this.blacklistedUsers.set(userId, {
        username,
        reason,
        timestamp,
      });
      await this.saveBlacklist();
      Logger.info(`Blacklisted user with ID ${userId}`);
    } catch (error) {
      Logger.error(`Failed to blacklist user: ${userId}`, error);
      throw error;
    }
  }

  public async removeUser(userId: string): Promise<boolean> {
    try {
      const removed = this.blacklistedUsers.delete(userId);
      if (removed) {
        await this.saveBlacklist();
        Logger.info(`Removed user ${userId} from blacklist`);
      }
      return removed;
    } catch (error) {
      Logger.error(`Failed to remove user from blacklist: ${userId}`, error);
      throw error;
    }
  }

  public async changeReason(userId: string, newReason: string): Promise<void> {
    try {
      const currentEntry = this.blacklistedUsers.get(userId);
      if (!currentEntry) {
        throw new Error("User not found in blacklist");
      }

      this.blacklistedUsers.set(userId, {
        ...currentEntry,
        reason: newReason,
      });

      await this.saveBlacklist();
      Logger.info(`Updated blacklist reason for user ${userId}: ${newReason}`);
    } catch (error) {
      Logger.error(
        `Failed to update blacklist reason for user: ${userId}`,
        error,
      );
      throw error;
    }
  }

  public searchBlacklist(query: string): Array<[string, BlacklistEntry]> {
    query = query.toLowerCase();
    const results = Array.from(this.blacklistedUsers.entries()).filter(
      ([id, entry]) => {
        return (
          id.toLowerCase().includes(query) ||
          entry.username.toLowerCase().includes(query) ||
          entry.reason.toLowerCase().includes(query)
        );
      },
    );

    if (results.length > 0) {
      Logger.info(`Found ${results.length} blacklist entries matching query`);
    }

    return results;
  }

  public getBlacklistInfo(userId: string): BlacklistEntry | null {
    return this.blacklistedUsers.get(userId) || null;
  }

  public isBlacklisted(userId: string): boolean {
    return this.blacklistedUsers.has(userId);
  }

  public cleanup(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      Logger.debug("Blacklist file watcher closed");
    }
  }
}
