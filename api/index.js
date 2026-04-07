// Minimal test serverless function
export default function handler(req, res) {
  res.status(200).json({
    message: "Serverless function is working",
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
}