import bcrypt from "bcryptjs";
import { storage } from "../server/storage";

async function seedDemoUser() {
  const existing = await storage.getUserByUsername("demo");
  if (existing) {
    // Reset password to the known demo credentials (idempotent re-seed)
    const hashedPassword = await bcrypt.hash("demo123", 10);
    await storage.updateUser(existing.id, { password: hashedPassword } as any);
    console.log("[v0] Demo user already exists, password reset:", existing.id);
    return;
  }

  const user = await storage.createUser({
    username: "demo",
    password: "demo123",
  });
  console.log("[v0] Created demo user:", user.id);

  await storage.createUserProfile({
    userId: user.id,
    firstName: "Demo",
    lastName: "User",
    email: "demo@bloomterminal.com",
    avatar: undefined,
    company: undefined,
    jobTitle: undefined,
    phone: undefined,
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
  });
  console.log("[v0] Created demo user profile");

  await storage.createUserPreferences({
    userId: user.id,
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
    tradingHours: "market",
  });
  console.log("[v0] Created demo user preferences");

  // Seed a starter watchlist
  const symbols: Array<{ symbol: string; assetType: string }> = [
    { symbol: "AAPL", assetType: "stock" },
    { symbol: "MSFT", assetType: "stock" },
    { symbol: "GOOGL", assetType: "stock" },
    { symbol: "TSLA", assetType: "stock" },
    { symbol: "NVDA", assetType: "stock" },
    { symbol: "BTC", assetType: "crypto" },
    { symbol: "ETH", assetType: "crypto" },
  ];
  for (const item of symbols) {
    try {
      await storage.addToWatchlist({
        userId: user.id,
        symbol: item.symbol,
        assetType: item.assetType,
      } as any);
    } catch (e) {
      console.log("[v0] Skipped watchlist item", item.symbol);
    }
  }
  console.log("[v0] Seeded watchlist");
}

seedDemoUser()
  .then(() => {
    console.log("[v0] Seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[v0] Seed failed:", err);
    process.exit(1);
  });
