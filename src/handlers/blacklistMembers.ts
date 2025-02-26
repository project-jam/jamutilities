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
      lines.forEach((line) => {
        const [id, username, reason, timestamp] = line
          .split("=")
          .map((part) => part.trim());
        if (id && username && reason) {
          newBlacklist.set(id, {
            username,
            reason,
            timestamp: parseInt(timestamp) || Date.now(),
          });
        }
      });

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
        .map(
          ([id, entry]) =>
            `${id}=${entry.username}=${entry.reason}=${entry.timestamp}`,
        )
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
      const timestamp = Date.now();
      this.blacklistedUsers.set(userId, {
        username,
        reason,
        timestamp,
      });
      await this.saveBlacklist();

      const date = new Date(timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      Logger.info(`Blacklisted user with ID ${userId} on ${date}`);
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

  public searchBlacklist(query: string): Array<[string, BlacklistEntry]> {
    query = query.toLowerCase();
    const results = Array.from(this.blacklistedUsers.entries()).filter(
      ([id, entry]) => {
        return (
          id.toLowerCase().includes(query) ||
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
    const info = this.blacklistedUsers.get(userId);
    if (info) {
      const date = new Date(info.timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      Logger.debug(
        `Retrieved blacklist info for ID ${userId} (Blacklisted on ${date})`,
      );
    }
    return info || null;
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
