// Any setup scripts you might need go here

// Load .env files. Next.js loads .env.local automatically, but Vitest does
// not, and that is where DATABASE_URI and other local secrets live.
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });
