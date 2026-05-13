![Example](example.gif)

# 🎬 Zenith Movies (Ad-Free Scraper)

A simple movie streaming frontend that pulls video sources using scripts originally based on Vidlink. This version removes ads and provides a clean, minimal playback experience.

## 🚀 Features

* 🎥 Stream movies directly in-browser
* ⚡ Fast loading using HLS streams
* 🚫 No ads (cleaned version of original scripts)
* 🌐 Deployed easily with Netlify or Vercel
* 🔗 Simple URL-based playback system

## 🧠 How It Works

This project uses a scraping/proxy approach to retrieve video streams and display them in a native HTML5 player.

Example:

```
https://your-site.netlify.app/?id=550
```

* `id` = Movie ID (typically from TMDB or similar source)
* The app fetches and injects the stream into a video player
* Playback is handled using HLS

## 📁 Project Structure

```
/
├── index.html              # Main frontend and API scrape bootstrap
├── player.css              # Custom player overlay styles
├── player.js               # Custom player overlay controls
├── netlify.toml            # Netlify build, function assets, and API rewrites
├── /netlify/functions/api.js # Netlify serverless API + HLS proxy
├── /netlify/functions/script.js # Netlify API runtime helper
└── /api                    # Vercel serverless API and assets
```

## 🛠️ Deployment (Netlify)

1. Clone or fork this repo
2. Go to https://app.netlify.com
3. Click **"Add new site"** → **"Import an existing project"**
4. Import your repo
5. Keep the publish directory as the repo root (`.`) and leave the build command empty
6. Deploy

The included `netlify.toml` routes `/api` requests to the Netlify Function at `/.netlify/functions/api`, so the frontend can keep using the same `/api?id=...` and `/api?url=...` paths. All Netlify API runtime files live inside `netlify/functions/`.

## 🛠️ Deployment (Vercel)

The existing `vercel.json` still supports Vercel deployments by rewriting `/api` to `api/index.js`.

## ⚠️ Important Notes

* This project is for **educational purposes only**
* Streaming copyrighted content without permission may violate laws in your country
* The original scripts were modified to remove ads, but credit belongs to their respective creators

## 📌 Usage

Just open:

```
https://your-netlify-url.netlify.app/?id=MOVIE_ID
```

That’s it. No accounts, no UI clutter — just press play.

## 💡 Future Improvements

* Playback quality selector
* Subtitles support
* TV / remote-friendly controls
* Better error handling

---

## ⭐ Support

If you like this project, consider giving it a star ⭐ on GitHub!
