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

After deployment, your API will be available at:
- `https://your-project.vercel.app/api/login`
- `https://your-project.vercel.app/api/register`
- And other endpoints...

### Local Development

```bash
cd backend
npm install
npm run dev  # Development with nodemon
npm start    # Production
```

### Project Structure

- `backend/api/index.js` - Vercel serverless function entry point
- `backend/app.js` - Express application setup
- `backend/routes/` - API route handlers
- `backend/models/` - MongoDB models
- `backend/middlewares/` - Authentication and other middleware
- `backend/controllers/` - Route controllers
- `vercel.json` - Vercel deployment configuration