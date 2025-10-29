# Halo Brand - Social Media Scheduling & Analytics Platform

<p align="center">
  <a href="https://halo-brand.com">
    <svg width="200" height="60" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="60" rx="12" fill="url(#gradient)"/>
      <circle cx="30" cy="30" r="12" fill="white" opacity="0.9"/>
      <circle cx="30" cy="30" r="8" fill="url(#innerGradient)"/>
      <text x="55" y="25" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="white">Halo</text>
      <text x="55" y="42" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="white" opacity="0.8">Brand</text>
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="innerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffecd2;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#fcb69f;stop-opacity:1" />
        </linearGradient>
      </defs>
    </svg>
  </a>
</p>

🚀 **Halo Brand** is a social media scheduling and analytics platform similar to Metricool, built with AI assistance. Schedule, post, and analyze social media content across multiple platforms with intelligent automation and insights.

## 🌟 Key Features

### Social Media Management
- 📱 **Multi-Platform Support** - Facebook, Instagram, X (Twitter), LinkedIn
- ⏰ **Smart Scheduling** - AI-powered optimal posting times
- 📝 **AI Content Generation** - Automated captions and hashtag suggestions
- 📊 **Analytics Dashboard** - Performance tracking and insights
- 📧 **Weekly Reports** - Automated email summaries
- 👥 **Multi-Account Management** - Handle multiple social accounts

### Core Technologies
- ⚡ **Next.js 16** with App Router and React 19
- 🔥 **TypeScript** with strict mode for type safety
- 💎 **Tailwind CSS** with Radix UI components
- 🗄️ **Supabase** - Complete backend (Postgres + Auth + Storage + Edge Functions)
- 🤖 **OpenAI API** - AI captions, hashtags, and insights
- ⚡ **QStash (Upstash)** - Serverless task scheduling
- 🚀 **Vercel** - Deployment with global CDN

### AI-Powered Features
- 🧠 **Smart Captions** - AI-generated content suggestions
- 🏷️ **Hashtag Optimization** - Trending and relevant hashtag recommendations
- 📈 **Best Time Analysis** - AI-driven optimal posting schedule
- 📊 **Performance Insights** - Automated analytics summaries
- 🎯 **Content Optimization** - AI-powered engagement predictions

### Developer Experience
- 📏 **Biome** for fast linting and formatting
- 🦺 **Vitest** for unit testing
- 🧪 **Cypress** for E2E testing
- 🔍 **TypeScript** strict mode with advanced types
- 💡 **Absolute imports** using `@` prefix
- 🗂 **VSCode** configuration with debug support

### Performance & Security
- 🔐 **Row Level Security (RLS)** with Supabase
- 🛡️ **OAuth Integration** - Secure social platform connections
- ⚡ **Server Components** for optimal performance
- 🎯 **Server Actions** for form handling and mutations
- 📊 **Sentry + Vercel Analytics** for monitoring
- 🔄 **Optimistic updates** with React 19 hooks

## 🏗️ Architecture

### Tech Stack Overview
| Layer | Service | Purpose |
|-------|---------|---------|
| Frontend | Next.js + TypeScript on Vercel | Global CDN, instant deployment |
| Backend/DB | Supabase (Postgres + Auth + Storage + Edge Functions) | Complete backend with API and auth |
| Scheduler/Queue | QStash (Upstash) | Serverless scheduling, zero maintenance |
| AI Features | OpenAI API | Captions, hashtags, insights |
| Email/Reports | Resend or Brevo | Transactional email delivery |
| Monitoring | Sentry + Vercel Analytics | Error & performance monitoring |
| Payments | PayPal Subscriptions | Subscription management |

### Project Structure
| Layer | Service | Purpose |
|-------|---------|---------|
| Frontend | Next.js + TypeScript on Vercel | Global CDN, instant deployment |
| Backend/DB | Supabase (Postgres + Auth + Storage + Edge Functions) | Complete backend with API and auth |
| Scheduler/Queue | QStash (Upstash) | Serverless scheduling, zero maintenance |
| AI Features | OpenAI API | Captions, hashtags, insights |
| Email/Reports | Resend or Brevo | Transactional email delivery |
| Monitoring | Sentry + Vercel Analytics | Error & performance monitoring |
| Payments | PayPal Subscriptions | Subscription management |
