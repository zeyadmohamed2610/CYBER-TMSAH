# Attendance Management System - Deployment Guide

## Prerequisites

1. Node.js 18+ installed
2. Firebase CLI installed (`npm install -g firebase-tools`)
3. A Firebase project (Blaze plan required for Cloud Functions)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., `attendance-system`)
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Required Services

In Firebase Console:

### Authentication
1. Go to **Build > Authentication**
2. Click "Get started"
3. Enable **Email/Password** provider
4. Save

### Firestore Database
1. Go to **Build > Firestore Database**
2. Click "Create database"
3. Start in **production mode**
4. Choose your region
5. Click "Enable"

### Cloud Functions
1. Go to **Build > Functions**
2. Click "Get started"
3. Upgrade to Blaze plan if needed

### Storage (Optional)
1. Go to **Build > Storage**
2. Click "Get started"
3. Follow setup wizard

## Step 3: Configure Environment Variables

### Frontend (.env)
Create `.env` file in project root:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### Backend (Cloud Functions)
Create `.env` file in `functions/` directory:

```env
SERVER_SECRET=your-super-secret-key-min-32-chars-change-this-in-production
OWNER_EMAIL=owner@yourdomain.com
```

**IMPORTANT**: 
- `SERVER_SECRET` must be at least 32 characters
- Never commit these files to version control
- Generate a strong secret: `openssl rand -base64 32`

## Step 4: Initialize Firebase CLI

```bash
# Login to Firebase
firebase login

# Initialize Firebase in project
firebase init
```

Select:
- Functions
- Firestore
- Hosting
- Storage

Choose your Firebase project when prompted.

## Step 5: Install Dependencies

```bash
# Frontend dependencies
npm install

# Functions dependencies
cd functions
npm install
cd ..
```

## Step 6: Set Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

## Step 7: Deploy Security Rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## Step 8: Deploy Cloud Functions

```bash
# Set environment variables for functions
firebase functions:config:set server.secret="your-super-secret-key"

# Deploy functions
firebase deploy --only functions
```

## Step 9: Build and Deploy Frontend

```bash
# Build frontend
npm run build

# Deploy hosting
firebase deploy --only hosting
```

## Step 10: Create Owner Account

### Option A: Via Firebase Console
1. Go to **Authentication > Users**
2. Click "Add user"
3. Enter the owner email and password

### Option B: Via Script
Create a script to set owner claims:

```javascript
// In Cloud Functions Shell or Admin SDK
admin.auth().setCustomUserClaims('owner-uid', { role: 'owner' });
```

Then update Firestore:

```javascript
admin.firestore().collection('users').doc('owner-uid').set({
  role: 'owner',
  email: 'owner@example.com',
  name: 'System Owner'
}, { merge: true });
```

## Step 11: Configure Firebase Auth Settings

### Email Verification
1. Go to **Authentication > Settings**
2. Enable "Email verification"
3. Customize email templates

### Password Requirements
The system enforces:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

## Step 12: Create Doctor Accounts

Doctors can be created in two ways:

### Via Owner Dashboard
1. Login as owner
2. Go to Users tab
3. Create new doctor account
4. Set role to "doctor"

### Via Firebase Console
1. Create user in Authentication
2. Set custom claims: `{ role: 'doctor' }`
3. Create user document in Firestore

## Step 13: Verify Deployment

1. Visit your hosting URL
2. Test login functionality
3. Create a test session
4. Verify rotating hash generation
5. Test attendance marking flow

## Security Checklist

- [ ] `.env` files not committed
- [ ] `SERVER_SECRET` is strong (32+ chars)
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] Owner account created with correct claims
- [ ] Rate limiting working
- [ ] Geo-fencing tested

## Monitoring

### View Logs
```bash
firebase functions:log
```

### Firebase Console
- **Authentication**: View user activity
- **Firestore**: View database usage
- **Functions**: View function logs and metrics
- **Hosting**: View deployment history

## Troubleshooting

### Functions not deploying
- Check Node.js version (must be 18 or 20)
- Verify all dependencies are installed
- Check for TypeScript errors

### Authentication errors
- Verify API keys in `.env`
- Check Firebase Auth is enabled
- Verify email/password provider is active

### Firestore permission errors
- Check security rules
- Verify user claims are set
- Check Firestore indexes

### Geo-location not working
- HTTPS is required for geolocation
- Check browser permissions
- Verify coordinates are valid

## Cost Estimation

For 657 students with ~5 sessions per week:

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Firestore | $5-15 |
| Functions | $2-10 |
| Hosting | $0-5 |
| Auth | Free tier |
| **Total** | **$7-30/month** |

## Scaling Tips

1. Enable Firestore caching
2. Use Firebase Extensions for common tasks
3. Optimize function cold starts
4. Monitor function execution times
5. Set up budget alerts

## Support

For issues:
1. Check Firebase Console logs
2. Review Cloud Functions logs
3. Test with Firebase Emulator locally
4. Contact system administrator
