import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true when using HTTPS
      maxAge: sessionTtl,
    },
  });
}

export async function setupBasicAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Basic auth login endpoint
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      console.log("Login attempt received:", { body: req.body });
      const { username, password } = req.body;
      
      // Check basic auth credentials from environment
      const validUsername = process.env.BASIC_AUTH_USERNAME;
      const validPassword = process.env.BASIC_AUTH_PASSWORD;
      
      console.log("Environment check:", { 
        hasValidUsername: !!validUsername,
        hasValidPassword: !!validPassword,
        receivedUsername: username
      });
      
      if (!validUsername || !validPassword) {
        return res.status(500).json({ message: "Basic auth not configured" });
      }
      
      if (username !== validUsername || password !== validPassword) {
        console.log("Credential mismatch");
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      console.log("Credentials valid, checking user in database...");
      
      // Create or get admin user
      let user = await storage.getUserByUsername(username);
      console.log("Existing user found:", !!user);
      
      if (!user) {
        console.log("Creating new user...");
        user = await storage.createUser({
          id: "admin-user-1",
          username,
          email: "admin@qms.local",
          firstName: "Admin",
          lastName: "User",
          role: "skip_manager", // Give admin highest permissions
        });
        console.log("User created:", user);
      }
      
      console.log("Storing user in session...");
      // Store user in session
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        role: user.role,
        claims: { sub: user.id } // For compatibility with existing code
      };
      
      console.log("Login successful for user:", user.username);
      res.json({ message: "Login successful", user: { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      }});
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logout successful" });
    });
  });
}

export const isAuthenticated: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const user = (req.session as any)?.user;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Attach user to request for compatibility with existing routes
  (req as any).user = user;
  next();
};

// Middleware to check if user has required role
export const requireRole = (role: string): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any)?.user;
    
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (user.role !== role && user.role !== 'skip_manager') { // skip_manager has all permissions
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    next();
  };
};