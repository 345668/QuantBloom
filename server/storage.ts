import { 
  type User, 
  type InsertUser, 
  type UserProfile,
  type InsertUserProfile,
  type UserPreferences,
  type InsertUserPreferences,
  type Notification,
  type InsertNotification,
  type AuthUser,
  type Watchlist, 
  type InsertWatchlist, 
  type PortfolioPosition, 
  type InsertPortfolioPosition, 
  type StockQuote, 
  type CryptoQuote, 
  type NewsItem, 
  type ChartData, 
  type Alert, 
  type InsertAlert, 
  type AlertSelect, 
  type TriggeredAlert,
  type AssetUniverse,
  type CryptoMarketCache,
  type InsertCryptoMarketCache,
  users,
  userProfiles,
  userPreferences,
  notifications,
  watchlists,
  portfolioPositions,
  alerts,
  assetUniverse,
  cryptoMarketCache
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User authentication methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getDemoUser(): Promise<User | undefined>;
  getAuthUser(userId: string): Promise<AuthUser | undefined>;
  verifyPassword(username: string, password: string): Promise<AuthUser | null>;
  
  // User profile methods
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  getUserProfileByEmail(email: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | undefined>;
  
  // User preferences methods
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined>;
  
  // Notification methods
  getNotifications(userId: string, limit?: number, onlyUnread?: boolean): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(notificationId: string): Promise<boolean>;
  markAllNotificationsAsRead(userId: string): Promise<number>;
  deleteNotification(notificationId: string): Promise<boolean>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  
  // Watchlist methods
  getWatchlist(userId: string): Promise<Watchlist[]>;
  addToWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  removeFromWatchlist(id: string): Promise<boolean>;
  
  // Portfolio methods
  getPortfolio(userId: string): Promise<PortfolioPosition[]>;
  addPosition(position: InsertPortfolioPosition): Promise<PortfolioPosition>;
  updatePosition(id: string, position: Partial<PortfolioPosition>): Promise<PortfolioPosition | undefined>;
  removePosition(id: string): Promise<boolean>;
  
  // Stock cache methods
  getStockQuote(symbol: string): Promise<StockQuote | undefined>;
  setStockQuote(quote: StockQuote): Promise<void>;
  
  // Crypto cache methods
  getCryptoQuote(symbol: string): Promise<CryptoQuote | undefined>;
  setCryptoQuote(quote: CryptoQuote): Promise<void>;
  
  // Crypto market cache methods (persistent storage for rate limiting)
  getCryptoMarketCache(cacheKey: string): Promise<any | null>;
  setCryptoMarketCache(cacheKey: string, dataType: string, data: any, ttlMinutes: number): Promise<void>;
  clearExpiredCryptoCache(): Promise<void>;
  
  // News cache methods
  getNews(limit?: number): Promise<NewsItem[]>;
  addNews(news: NewsItem): Promise<void>;
  
  // Chart data cache methods
  getChartData(symbol: string, interval: string): Promise<ChartData[] | undefined>;
  setChartData(symbol: string, interval: string, data: ChartData[]): Promise<void>;
  
  // Crypto chart data cache methods
  getCryptoChartData(symbol: string, interval: string): Promise<ChartData[] | undefined>;
  setCryptoChartData(symbol: string, interval: string, data: ChartData[]): Promise<void>;
  
  // Alerts management methods
  createAlert(insertAlert: InsertAlert): Promise<Alert>;
  updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(alertId: string): Promise<boolean>;
  getAlertById(alertId: string): Promise<Alert | undefined>;
  listAlertsByUser(userId: string): Promise<Alert[]>;
  
  // Triggered alerts methods
  recordTriggeredAlert(triggeredAlert: TriggeredAlert): Promise<void>;
  listTriggeredAlerts(userId: string, limit?: number): Promise<TriggeredAlert[]>;
  
  // Asset universe methods
  getAssetsByFilter(filter: { asset_type?: string; sector?: string }): Promise<AssetUniverse[]>;
}

export class DatabaseStorage implements IStorage {
  // In-memory caches for frequently accessed data (will be eventually moved to Redis)
  private stockQuotes: Map<string, StockQuote> = new Map();
  private cryptoQuotes: Map<string, CryptoQuote> = new Map();
  private news: NewsItem[] = [];
  private chartData: Map<string, ChartData[]> = new Map();
  private cryptoChartData: Map<string, ChartData[]> = new Map();
  private triggeredAlerts: TriggeredAlert[] = [];

  // User authentication methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      const [user] = await db
        .insert(users)
        .values({
          ...insertUser,
          password: hashedPassword,
        })
        .returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    try {
      const [user] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      return user || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async getDemoUser(): Promise<User | undefined> {
    return this.getUserByUsername("demo");
  }

  async getAuthUser(userId: string): Promise<AuthUser | undefined> {
    try {
      const user = await this.getUser(userId);
      if (!user) return undefined;

      const profile = await this.getUserProfile(userId);
      const preferences = await this.getUserPreferences(userId);

      return {
        ...user,
        profile: profile || null,
        preferences: preferences || null,
      };
    } catch (error) {
      console.error('Error getting auth user:', error);
      return undefined;
    }
  }

  async verifyPassword(username: string, password: string): Promise<AuthUser | null> {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) return null;

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return null;

      // Update last login timestamp
      await this.updateUser(user.id, { lastLoginAt: new Date() });

      return await this.getAuthUser(user.id) || null;
    } catch (error) {
      console.error('Error verifying password:', error);
      return null;
    }
  }

  // User profile methods
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    try {
      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
      return profile || undefined;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return undefined;
    }
  }

  async getUserProfileByEmail(email: string): Promise<UserProfile | undefined> {
    try {
      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.email, email));
      return profile || undefined;
    } catch (error) {
      console.error('Error getting user profile by email:', error);
      return undefined;
    }
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    try {
      const [createdProfile] = await db
        .insert(userProfiles)
        .values(profile)
        .returning();
      return createdProfile;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | undefined> {
    try {
      const [profile] = await db
        .update(userProfiles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId))
        .returning();
      return profile || undefined;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return undefined;
    }
  }

  // User preferences methods
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    try {
      const [preferences] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
      return preferences || undefined;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return undefined;
    }
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    try {
      const [createdPreferences] = await db
        .insert(userPreferences)
        .values(preferences)
        .returning();
      return createdPreferences;
    } catch (error) {
      console.error('Error creating user preferences:', error);
      throw new Error('Failed to create user preferences');
    }
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    try {
      const [preferences] = await db
        .update(userPreferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId))
        .returning();
      return preferences || undefined;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return undefined;
    }
  }

  // Notification methods
  async getNotifications(userId: string, limit: number = 50, onlyUnread: boolean = false): Promise<Notification[]> {
    try {
      let query = db.select().from(notifications).where(eq(notifications.userId, userId));
      
      if (onlyUnread) {
        query = query.where(eq(notifications.isRead, false));
      }
      
      const result = await query
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
      
      return result;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      const [createdNotification] = await db
        .insert(notifications)
        .values(notification)
        .returning();
      return createdNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(notifications.id, notificationId))
        .returning();
      return !!updated;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(notifications)
        .where(eq(notifications.id, notificationId));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return result.length;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  // Watchlist methods
  async getWatchlist(userId: string): Promise<Watchlist[]> {
    try {
      const result = await db
        .select()
        .from(watchlists)
        .where(eq(watchlists.userId, userId))
        .orderBy(desc(watchlists.addedAt));
      return result;
    } catch (error) {
      console.error('Error getting watchlist:', error);
      return [];
    }
  }

  async addToWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    try {
      const [created] = await db
        .insert(watchlists)
        .values(watchlist)
        .returning();
      return created;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      throw new Error('Failed to add to watchlist');
    }
  }

  async removeFromWatchlist(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(watchlists)
        .where(eq(watchlists.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      return false;
    }
  }

  // Portfolio methods
  async getPortfolio(userId: string): Promise<PortfolioPosition[]> {
    try {
      const result = await db
        .select()
        .from(portfolioPositions)
        .where(eq(portfolioPositions.userId, userId))
        .orderBy(desc(portfolioPositions.addedAt));
      return result;
    } catch (error) {
      console.error('Error getting portfolio:', error);
      return [];
    }
  }

  async addPosition(position: InsertPortfolioPosition): Promise<PortfolioPosition> {
    try {
      const [created] = await db
        .insert(portfolioPositions)
        .values(position)
        .returning();
      return created;
    } catch (error) {
      console.error('Error adding position:', error);
      throw new Error('Failed to add position');
    }
  }

  async updatePosition(id: string, position: Partial<PortfolioPosition>): Promise<PortfolioPosition | undefined> {
    try {
      const [updated] = await db
        .update(portfolioPositions)
        .set(position)
        .where(eq(portfolioPositions.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error('Error updating position:', error);
      return undefined;
    }
  }

  async removePosition(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(portfolioPositions)
        .where(eq(portfolioPositions.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error removing position:', error);
      return false;
    }
  }

  // Cache methods (in-memory for now, will be moved to Redis later)
  async getStockQuote(symbol: string): Promise<StockQuote | undefined> {
    return this.stockQuotes.get(symbol);
  }

  async setStockQuote(quote: StockQuote): Promise<void> {
    this.stockQuotes.set(quote.symbol, quote);
  }

  async getCryptoQuote(symbol: string): Promise<CryptoQuote | undefined> {
    return this.cryptoQuotes.get(symbol);
  }

  async setCryptoQuote(quote: CryptoQuote): Promise<void> {
    this.cryptoQuotes.set(quote.symbol, quote);
  }

  async getNews(limit: number = 50): Promise<NewsItem[]> {
    return this.news.slice(0, limit);
  }

  async addNews(news: NewsItem): Promise<void> {
    this.news.unshift(news);
    // Keep only latest 100 news items
    if (this.news.length > 100) {
      this.news = this.news.slice(0, 100);
    }
  }

  async getChartData(symbol: string, interval: string): Promise<ChartData[] | undefined> {
    return this.chartData.get(`${symbol}_${interval}`);
  }

  async setChartData(symbol: string, interval: string, data: ChartData[]): Promise<void> {
    this.chartData.set(`${symbol}_${interval}`, data);
  }

  async getCryptoChartData(symbol: string, interval: string): Promise<ChartData[] | undefined> {
    return this.cryptoChartData.get(`${symbol}_${interval}`);
  }

  async setCryptoChartData(symbol: string, interval: string, data: ChartData[]): Promise<void> {
    this.cryptoChartData.set(`${symbol}_${interval}`, data);
  }

  // Alert methods
  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    try {
      const [created] = await db
        .insert(alerts)
        .values(insertAlert)
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw new Error('Failed to create alert');
    }
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert | undefined> {
    try {
      const [updated] = await db
        .update(alerts)
        .set(updates)
        .where(eq(alerts.id, alertId))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error('Error updating alert:', error);
      return undefined;
    }
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(alerts)
        .where(eq(alerts.id, alertId));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting alert:', error);
      return false;
    }
  }

  async getAlertById(alertId: string): Promise<Alert | undefined> {
    try {
      const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
      return alert || undefined;
    } catch (error) {
      console.error('Error getting alert by id:', error);
      return undefined;
    }
  }

  async listAlertsByUser(userId: string): Promise<Alert[]> {
    try {
      const result = await db
        .select()
        .from(alerts)
        .where(eq(alerts.userId, userId))
        .orderBy(desc(alerts.createdAt));
      return result;
    } catch (error) {
      console.error('Error listing alerts by user:', error);
      return [];
    }
  }

  // Triggered alerts methods (in-memory for now)
  async recordTriggeredAlert(triggeredAlert: TriggeredAlert): Promise<void> {
    this.triggeredAlerts.unshift(triggeredAlert);
    // Keep only latest 1000 triggered alerts
    if (this.triggeredAlerts.length > 1000) {
      this.triggeredAlerts = this.triggeredAlerts.slice(0, 1000);
    }
  }

  async listTriggeredAlerts(userId: string, limit: number = 50): Promise<TriggeredAlert[]> {
    return this.triggeredAlerts
      .filter(alert => alert.userId === userId)
      .slice(0, limit);
  }

  // Asset universe methods
  async getAssetsByFilter(filter: { asset_type?: string; sector?: string }): Promise<AssetUniverse[]> {
    try {
      let query = db.select().from(assetUniverse);
      const conditions = [];

      if (filter.asset_type) {
        conditions.push(eq(assetUniverse.assetType, filter.asset_type));
      }
      
      if (filter.sector) {
        conditions.push(eq(assetUniverse.category, filter.sector));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query;
      return results;
    } catch (error) {
      console.error('Error getting assets by filter:', error);
      return [];
    }
  }

  // Crypto market cache methods - persistent storage for handling rate limits
  async getCryptoMarketCache(cacheKey: string): Promise<any | null> {
    try {
      const [cached] = await db
        .select()
        .from(cryptoMarketCache)
        .where(eq(cryptoMarketCache.cacheKey, cacheKey))
        .limit(1);
      
      if (!cached) {
        return null;
      }
      
      // Check if expired
      if (new Date() > cached.expiresAt) {
        // Delete expired entry
        await db.delete(cryptoMarketCache).where(eq(cryptoMarketCache.cacheKey, cacheKey));
        return null;
      }
      
      // Parse and return data
      return JSON.parse(cached.data);
    } catch (error) {
      console.error('Error getting crypto market cache:', error);
      return null;
    }
  }

  async setCryptoMarketCache(cacheKey: string, dataType: string, data: any, ttlMinutes: number): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
      
      // Try to insert or update
      const existing = await db
        .select()
        .from(cryptoMarketCache)
        .where(eq(cryptoMarketCache.cacheKey, cacheKey))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing
        await db
          .update(cryptoMarketCache)
          .set({
            data: JSON.stringify(data),
            dataType,
            expiresAt,
            updatedAt: now,
          })
          .where(eq(cryptoMarketCache.cacheKey, cacheKey));
      } else {
        // Insert new
        await db.insert(cryptoMarketCache).values({
          cacheKey,
          dataType,
          data: JSON.stringify(data),
          expiresAt,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      console.error('Error setting crypto market cache:', error);
    }
  }

  async clearExpiredCryptoCache(): Promise<void> {
    try {
      const now = new Date();
      await db
        .delete(cryptoMarketCache)
        .where(sql`${cryptoMarketCache.expiresAt} < ${now}`);
    } catch (error) {
      console.error('Error clearing expired crypto cache:', error);
    }
  }
}

// Create database storage instance and initialize with demo data
export const storage = new DatabaseStorage();

// Initialize demo data for development
async function initializeDemoData() {
  try {
    // Check if demo user already exists
    const existingDemoUser = await storage.getUserByUsername("demo");
    if (existingDemoUser) {
      console.log("Demo user already exists, skipping initialization");
      return;
    }

    console.log("Initializing demo data...");
    
    // Create demo user
    const demoUser = await storage.createUser({
      username: "demo",
      password: "demo", // Will be hashed by storage.createUser
    });

    // Create demo user profile
    await storage.createUserProfile({
      userId: demoUser.id,
      firstName: "Demo",
      lastName: "User",
      email: "demo@bloomterminal.com",
      avatar: null,
      company: "Bloom Financial",
      jobTitle: "Financial Analyst",
      phone: "+1-555-0123",
      timezone: "America/New_York",
      dateFormat: "MM/DD/YYYY"
    });

    // Create demo user preferences
    await storage.createUserPreferences({
      userId: demoUser.id,
      defaultLayout: "grid",
      theme: "dark",
      fontSize: "medium",
      soundEnabled: false,
      autoRefreshInterval: 30,
      enableRealTimeData: true,
      defaultChartType: "candlestick",
      defaultTimeframe: "1D",
      showVolume: true,
      showIndicators: false,
      emailNotifications: false,
      browserNotifications: true,
      alertSounds: false,
      defaultWatchlists: JSON.stringify(["AAPL", "MSFT", "GOOGL"]),
      favoriteMarkets: JSON.stringify(["NYSE", "NASDAQ"]),
      tradingHours: "market"
    });

    // Create welcome notification
    await storage.createNotification({
      userId: demoUser.id,
      type: "system",
      title: "Welcome to Bloom Terminal",
      message: "Your account has been successfully created. Start by adding symbols to your watchlist.",
      priority: "medium",
      actionType: null,
      actionData: null,
      metadata: null
    });

    // Add demo watchlist items
    const watchlistSymbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"];
    for (const symbol of watchlistSymbols) {
      await storage.addToWatchlist({
        userId: demoUser.id,
        symbol: symbol,
        name: symbol,
        assetType: "stock"
      });
    }

    // Add demo portfolio positions
    const portfolioPositions = [
      { symbol: "AAPL", quantity: "100", avgPrice: "150.25", assetType: "stock" as const },
      { symbol: "MSFT", quantity: "75", avgPrice: "385.50", assetType: "stock" as const },
      { symbol: "GOOGL", quantity: "50", avgPrice: "130.80", assetType: "stock" as const }
    ];

    for (const position of portfolioPositions) {
      await storage.addPosition({
        userId: demoUser.id,
        ...position
      });
    }

    console.log("Demo data initialized successfully");
  } catch (error) {
    console.error("Error initializing demo data:", error);
  }
}

// Initialize demo data after a short delay to ensure database is ready
setTimeout(initializeDemoData, 2000);