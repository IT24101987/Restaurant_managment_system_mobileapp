import app from "../app.js";

export default function handler(req, res) {
  // Vercel serverless function handler
  return app(req, res);
}
