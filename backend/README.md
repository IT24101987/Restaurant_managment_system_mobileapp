# Restaurant Management System - Backend

## Vercel Deployment

This backend is configured for deployment on Vercel.

### Prerequisites
- Vercel account
- MongoDB database (MongoDB Atlas recommended)

### Environment Variables
Set these in your Vercel project settings:

- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (use a strong random string)
- `JWT_EXPIRES_IN` - Token expiration time (default: "7d")
- `CORS_ORIGIN` - Comma-separated list of allowed origins (e.g., "https://your-frontend.vercel.app")

### Deployment Steps

1. **Connect Repository**
   - Import this repository to Vercel
   - **Important:** Do NOT set a root directory - leave it as the repository root

2. **Configure Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all required environment variables

3. **Deploy**
   - Vercel will automatically detect the configuration in `vercel.json` and deploy the backend

### API Endpoints

After deployment, test these endpoints:

- `https://your-app.vercel.app/api/health` - Health check (if routes enabled)
- `https://your-app.vercel.app/api/test` - Test route (if routes enabled)
- `https://your-app.vercel.app/any-path` - Should return serverless function response

### Current Status

**Minimal Testing Mode**: Serverless function simplified to basic handler. All routes and complex middleware disabled for debugging.

### Local Development

```bash
cd backend
npm install
npm run dev  # Development with nodemon
npm start    # Production
```

### Project Structure

- `api/index.js` - Vercel serverless function entry point (in repository root)
- `backend/app.js` - Express application setup
- `backend/routes/` - API route handlers
- `backend/models/` - MongoDB models
- `backend/middlewares/` - Authentication and other middleware
- `backend/controllers/` - Route controllers
- `vercel.json` - Vercel deployment configuration (in repository root)