import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Path to store links and clicks
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "links.json");

// Define TypeScript interfaces
interface ClickLog {
  id: string;
  timestamp: string;
  userAgent: string;
  ip: string;
  referrer: string;
  browser: string;
  os: string;
  device: "Mobile" | "Tablet" | "Desktop" | "Unknown";
  queryParams: Record<string, string>;
}

interface TrackedLink {
  id: string;
  targetUrl: string;
  title: string;
  createdAt: string;
  clicks: ClickLog[];
}

// Ensure the data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), "utf8");
}

// Load and save links functions
function loadLinks(): TrackedLink[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error reading data file, resetting to empty array", error);
    return [];
  }
}

function saveLinks(links: TrackedLink[]): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(links, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing data file", error);
  }
}

// Generate unique custom link ID
function generateUniqueId(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const existing = loadLinks().map(l => l.id);
  let id = "";
  let attempts = 0;
  
  do {
    id = "";
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (existing.includes(id) && attempts < 100);
  
  return id;
}

// Simple User Agent Parser
function parseUserAgent(uaString: string): { browser: string; os: string; device: "Mobile" | "Tablet" | "Desktop" | "Unknown" } {
  if (!uaString) {
    return { browser: "Unknown", os: "Unknown", device: "Unknown" };
  }

  let browser = "Other";
  let os = "Other";
  let device: "Mobile" | "Tablet" | "Desktop" | "Unknown" = "Desktop";

  // Parse OS
  if (uaString.includes("Windows NT")) {
    os = "Windows";
  } else if (uaString.includes("Macintosh") || uaString.includes("Mac OS X")) {
    os = "macOS";
    if (uaString.includes("iPad") || (uaString.includes("Macintosh") && "ontouchend" in {})) {
      os = "iPadOS";
    }
  } else if (uaString.includes("iPhone")) {
    os = "iOS";
    device = "Mobile";
  } else if (uaString.includes("iPad")) {
    os = "iPadOS";
    device = "Tablet";
  } else if (uaString.includes("Android")) {
    os = "Android";
    device = uaString.includes("Mobile") ? "Mobile" : "Tablet";
  } else if (uaString.includes("Linux")) {
    os = "Linux";
  }

  // Parse Browser
  if (uaString.includes("Firefox/")) {
    browser = "Firefox";
  } else if (uaString.includes("Edg/")) {
    browser = "Edge";
  } else if (uaString.includes("Chrome/")) {
    browser = "Chrome";
  } else if (uaString.includes("Safari/") && !uaString.includes("Chrome/")) {
    browser = "Safari";
  } else if (uaString.includes("OPR/") || uaString.includes("Opera/")) {
    browser = "Opera";
  }

  // Double check device from typical patterns if not already set
  if (device === "Desktop") {
    const mobileKeywords = ["Mobi", "Android", "iPhone", "iPod", "BlackBerry", "IEMobile", "Opera Mini"];
    if (mobileKeywords.some(kw => uaString.includes(kw))) {
      device = "Mobile";
    }
  }

  return { browser, os, device };
}

// Middleware
app.use(express.json());

// API Routes
app.get("/api/config", (req, res) => {
  res.json({
    appUrl: process.env.APP_URL || null,
  });
});

// Fetch all tracked links
app.get("/api/links", (req, res) => {
  const links = loadLinks();
  res.json(links);
});

// Create a new tracked link
app.post("/api/links", (req, res) => {
  const { targetUrl, title } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: "Target URL is required" });
  }

  // Simple URL format validation/fix
  let formattedUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  try {
    new URL(formattedUrl);
  } catch (err) {
    return res.status(400).json({ error: "Invalid target URL format" });
  }

  const links = loadLinks();
  const id = generateUniqueId();
  
  const newLink: TrackedLink = {
    id,
    targetUrl: formattedUrl,
    title: title?.trim() || `Link to ${new URL(formattedUrl).hostname}`,
    createdAt: new Date().toISOString(),
    clicks: [],
  };

  links.unshift(newLink); // Add to the top
  saveLinks(links);

  res.status(201).json(newLink);
});

// Delete a tracked link
app.delete("/api/links/:id", (req, res) => {
  const { id } = req.params;
  const links = loadLinks();
  const index = links.findIndex(l => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Link not found" });
  }

  links.splice(index, 1);
  saveLinks(links);

  res.json({ success: true, message: "Link deleted successfully" });
});

// Redirect Tracker Endpoints (support both /t/:id and /track/:id)
const handleRedirect = (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const links = loadLinks();
  const linkIndex = links.findIndex(l => l.id === id);

  if (linkIndex === -1) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Link Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; color: #1f2937; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); max-width: 400px; width: 90%; }
            h1 { font-size: 1.5rem; color: #ef4444; margin-top: 0; }
            p { color: #4b5563; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
            .btn { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500; font-size: 0.9rem; transition: background 0.2s; }
            .btn:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Link Active but Track Code Expired or Invalid</h1>
            <p>The tracking code you requested was not found or has been removed by its creator.</p>
            <a href="/" class="btn">Create Your Own Tracked Links</a>
          </div>
        </body>
      </html>
    `);
  }

  const link = links[linkIndex];

  // Capture metadata
  const userAgent = req.headers["user-agent"] || "";
  const referrer = req.headers["referer"] || req.headers["referrer"] || "";
  
  // Get IP address safely
  let ip = "";
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    ip = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(",")[0]).trim();
  } else {
    ip = req.socket.remoteAddress || "";
  }
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    ip = "127.0.0.1";
  }

  // Parse details
  const { browser, os, device } = parseUserAgent(userAgent);

  // Capture any custom query parameters passed to the tracking URL
  const queryParams: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.query)) {
    if (typeof val === "string") {
      queryParams[key] = val;
    }
  }

  // Create click log
  const clickId = "clk_" + Math.random().toString(36).substring(2, 9);
  const click: ClickLog = {
    id: clickId,
    timestamp: new Date().toISOString(),
    userAgent,
    ip,
    referrer: typeof referrer === "string" ? referrer : "",
    browser,
    os,
    device,
    queryParams,
  };

  // Add click to link's clicks list
  link.clicks.push(click);
  saveLinks(links);

  // HTTP 302 Temporary Redirect to target destination
  res.redirect(302, link.targetUrl);
};

app.get("/t/:id", handleRedirect);
app.get("/track/:id", handleRedirect);

// Vite middleware / SPA static asset delivery
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LinkTracker] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
