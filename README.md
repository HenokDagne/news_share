# NewsShare

<p align="center">
	<img src="https://supabase.com/logos/supabase-logo-icon.svg" alt="Supabase Logo" width="48"/>
	<img src="https://storage.googleapis.com/cms-storage-bucket/0dbfcc7a59cd1cf16282.png" alt="Flutter Logo" width="48"/>
</p>

<h2 align="center">A modern, secure, and scalable cross-platform news sharing app built with <a href="https://flutter.dev/">Flutter</a> and <a href="https://supabase.com/">Supabase</a>.</h2>

---

## About

**NewsShare** is a full-featured news aggregation and social platform. Users can browse, search, and share news from top sources, follow other users, and receive real-time notifications. The app is designed for security, scalability, and a seamless user experience across mobile, web, and desktop.

## Project SRS

- Detailed Software Requirements Specification (SRS): [Google Doc](https://docs.google.com/document/d/12qh8hS6bCbr1lodMh8fbr4hANuIuXpUY/edit?usp=sharing&ouid=108335093438878048436&rtpof=true&sd=true)

### Why Supabase?

- **Authentication**: Secure user sign-up, login, and social auth (Google) using Supabase Auth.
- **Database**: All user data, posts, and relationships are stored in a scalable PostgreSQL database managed by Supabase.
- **Storage**: User avatars and media are stored and served securely via Supabase Storage.
- **Realtime**: Follows, notifications, and posts update instantly using Supabase's realtime features.

<details>
<summary><strong>Supabase Services Used</strong></summary>

- 🔐 **Auth**: Email/password & Google OAuth
- 🗄️ **Database**: PostgreSQL (hosted by Supabase)
- 🗂️ **Storage**: For user avatars and media
- ⚡ **Realtime**: Live updates for follows, notifications, and posts
- 🔒 **Row Level Security**: All data access is protected by RLS policies

</details>

---

## Features

- 📰 Browse the latest news from multiple sources (Tesla, Apple, TechCrunch, WSJ, Business, etc.)
- 🔍 Search and filter news articles
- 👤 Secure user authentication (Google Sign-In, Supabase Auth)
- 🏠 Personalized home feed
- 👥 Follow/unfollow users
- 📢 Real-time notifications and updates
- 📝 Post, share on news
- 🖼️ Upload and manage profile avatars
- 📱 Responsive UI for Android, iOS, Web, Windows, Mac, Linux
- 🌙 Light & dark mode support

## Tech Stack

- **Flutter** (Dart)
- **Supabase** (Auth, Storage, PostgreSQL, Realtime)
- **NewsAPI** ([newsapi.org](https://newsapi.org/))
- **Google Sign-In**
- **Provider/State Management**

---

## Getting Started

### Prerequisites

- [Flutter SDK](https://flutter.dev/docs/get-started/install) (3.x recommended)
- Dart
- [Supabase account &amp; project](https://app.supabase.com/)
- [NewsAPI key](https://newsapi.org/)

### Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd news_share_full_project/frontend/news_share
   ```
2. **Install dependencies:**
   ```bash
   flutter pub get
   ```
3. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in your keys:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_anon_key
     NEWS_API_KEY=your_newsapi_key
     client_ID=your_google_client_id
     ```
   - Never commit your real `.env` file to version control.
4. **Run the app:**
   ```bash
   flutter run
   ```

## Folder Structure

- `lib/` — Main Flutter app code
- `lib/screens/` — UI screens (home, auth, profile, news, etc.)
- `lib/models/` — Data models
- `lib/services/` — API and backend services
- `assets/` — Images, JSON, and other static assets
- `.env` — Environment variables (never commit secrets!)

## Security

- **Never commit your real API keys or secrets.** Use the `.env` file and add it to `.gitignore`.
- All sensitive keys are loaded at runtime and never hardcoded in the source.
- Supabase Row Level Security (RLS) is enabled for all tables.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License

This project is licensed under the MIT License.
