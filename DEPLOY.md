# 🚀 Deployment Guide - Veritas

## Quick Deploy to Vercel (5 minutes)

### Step 1: Open Vercel
**Click this link:** https://vercel.com/new

### Step 2: Sign in with GitHub
1. Click **"Continue with GitHub"**
2. Allow Vercel to access your repositories
3. You'll be redirected back to Vercel

### Step 3: Import Veritas
1. You'll see a list of your GitHub repos
2. Find **"Veritas"** or **"Leihyn/Veritas"**
3. Click **"Import"** next to it

### Step 4: Configure Project Settings

**Important Settings:**
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `frontend` ⚠️ **Must change this!**
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### Step 5: Add Environment Variables

Click **"Environment Variables"** and paste these:

#### Required Variables:

```
NEXT_PUBLIC_SUPABASE_URL
```
Value: `https://rrmtzqqooondyufrgzwn.supabase.co`

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJybXR6cXFvb29uZHl1ZnJnenduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NzU2MTcsImV4cCI6MjA3ODE1MTYxN30.MnDyej8uATXuztNdYraotHnASXOn3inf3eHEmBi_L2s`

```
NEXT_PUBLIC_CORE_ADDRESS_TESTNET
```
Value: `0x1aF9B68D3d1cF3e1A27ea33e44afb839a14012b6`

```
NEXT_PUBLIC_NFT_ADDRESS_TESTNET
```
Value: `0xa79805FAf84BCFb296b6C0fbA2BB222fDc319460`

```
NEXT_PUBLIC_CALCULATOR_ADDRESS_TESTNET
```
Value: `0x7f0A9634E531Bfbc5496108Fd4823571849B1B5d`

```
NEXT_PUBLIC_REGISTRY_ADDRESS_TESTNET
```
Value: `0x7Da9A2bd1502400bBc79Da05D87Bf825b10177e8`

```
NEXT_PUBLIC_COPY_TRADING_VAULT
```
Value: `0xf660ae86f4A2EE85CF16d7D8E40F3a34045Ce7B9`

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```
Value: `232d200ea6653a1035c5b87555234932`

```
NEXT_PUBLIC_DATA_MODE
```
Value: `demo`

### Step 6: Deploy!

Click the big **"Deploy"** button

Vercel will now:
- ✅ Clone your GitHub repo
- ✅ Install dependencies
- ✅ Build your Next.js app
- ✅ Deploy to production

**This takes 2-3 minutes.**

### Step 7: Get Your URL

Once deployed, you'll see:
```
🎉 Deployment Complete!

Your project is live at:
https://veritas-protocol-xyz.vercel.app
```

---

## 🔧 Troubleshooting

### Build Fails?

**Problem:** "Cannot find module 'next'"
**Solution:** Make sure "Root Directory" is set to `frontend`

**Problem:** "Environment variable not found"
**Solution:** Double-check all env variables are added in Vercel dashboard

### Need to Redeploy?

1. Go to https://vercel.com/dashboard
2. Click your project
3. Click "Deployments"
4. Click "Redeploy" on the latest deployment

---

## 📱 After Deployment

### Custom Domain (Optional)
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Monitor Usage
- Dashboard: https://vercel.com/dashboard
- Analytics: Available in project settings
- Logs: Click any deployment to see build logs

---

## ✅ Deployment Checklist

- [ ] Signed in to Vercel with GitHub
- [ ] Imported Veritas repo
- [ ] Set Root Directory to `frontend`
- [ ] Added all 9 environment variables
- [ ] Clicked Deploy
- [ ] Got public URL
- [ ] Tested deployed site
- [ ] Updated README with deployment URL

---

**Need help?** Check Vercel docs: https://vercel.com/docs
