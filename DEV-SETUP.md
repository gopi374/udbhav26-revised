# Development Setup for UDBHAV'26

## Running the Application Locally

You have two options for running the application with working API endpoints:

### Option 1: Vite Dev Server with API Proxy (Recommended for Development)

This setup runs Vite on port 5173 and proxies API requests to Express server on port 8080.

**Step 1:** Start the Express API server (in one terminal)
```bash
npm start
```
This will start the Express server on port 8080 with all API endpoints.

**Step 2:** Start Vite dev server (in another terminal)
```bash
npm run dev
```
This will start Vite on port 5173 and proxy `/api/*` requests to port 8080.

**Step 3:** Open your browser
```
http://localhost:5173/register
```

### Option 2: Production-like Server (For Testing Full Flow)

This builds the project and serves everything from one Express server.

```bash
npm run build
npm start
```

Then open: `http://localhost:8080/register`

## Environment Variables

Make sure you have a `.env` file with:

```env
MONGODB_URI=your_mongodb_connection_string
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## Testing Payment Flow

1. Fill out the registration form
2. Check both agreement checkboxes
3. Click "Pay ₹800 Securely" (or ₹1,100 if mentor session selected)
4. Razorpay payment gateway will open
5. Use Razorpay test credentials:
   - Card: 4111 1111 1111 1111
   - CVV: Any 3 digits
   - Expiry: Any future date
6. After successful payment, registration will be saved to MongoDB
7. Success confirmation page will be shown

## Troubleshooting

### API 404 Errors
- Make sure Express server is running on port 8080 (`npm start`)
- Check that Vite proxy is configured (already done in vite.config.js)
- Restart Vite dev server after changing vite.config.js

### Database Connection Issues
- Verify MongoDB URI in `.env` file
- Check MongoDB Atlas network access (whitelist your IP)
- Ensure database user has read/write permissions

### Payment Gateway Issues
- Verify Razorpay keys in `.env` file
- Use test mode keys for development
- Check Razorpay dashboard for webhook logs
