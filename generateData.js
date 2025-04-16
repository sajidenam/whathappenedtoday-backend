// Express-based backend for What Happened Today automation
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');
const dayjs = require('dayjs');

const app = express();
const PORT = process.env.PORT || 3000;

// API keys from Render environment variables
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const MARKET_API_KEY = process.env.MARKET_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchNews() {
  const res = await axios.get(`https://newsapi.org/v2/top-headlines?country=in&pageSize=5&apiKey=${NEWS_API_KEY}`);
  return { title: 'Top News', items: res.data.articles.map(a => a.title) };
}

async function fetchSports() {
  const res = await axios.get(`https://newsapi.org/v2/top-headlines?country=in&category=sports&pageSize=5&apiKey=${NEWS_API_KEY}`);
  return { title: 'Sports Updates', items: res.data.articles.map(a => a.title) };
}

async function fetchWeather() {
  const cities = ['Delhi', 'Hyderabad'];
  const items = [];
  for (const city of cities) {
    const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
    const temp = res.data.main.temp;
    const condition = res.data.weather[0].description;
    items.push(`${city}: ${temp}°C, ${condition}`);
  }
  return { title: 'Weather Today', items };
}

async function fetchMovies() {
  const res = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`);
  return {
    title: 'Entertainment Buzz',
    items: res.data.results.slice(0, 5).map(m => `${m.title} — ${m.overview.slice(0, 100)}...`)
  };
}

async function fetchMarkets() {
  const url = `https://financialmodelingprep.com/api/v3/quote/%5ENSEI,%5EBSESN?apikey=${MARKET_API_KEY}`;
  const res = await axios.get(url);
  return {
    title: 'Market Snapshot',
    items: res.data.map(i => `${i.name || i.symbol}: ${i.price}`)
  };
}

async function fetchExtras() {
  const [quote, fact, history] = await Promise.all([
    axios.get('https://api.quotable.io/random'),
    axios.get('https://uselessfacts.jsph.pl/random.json?language=en'),
    axios.get('https://history.muffinlabs.com/date')
  ]);
  return {
    quote: { title: 'Quote of the Day', content: `${quote.data.content} — ${quote.data.author}` },
    fact: { title: 'Quick Fact', content: fact.data.text },
    history: { title: 'Today in History', content: history.data.data.Events[0].text }
  };
}

async function buildDataJson() {
  const [news, sports, entertainment, weather, markets, extras] = await Promise.all([
    fetchNews(), fetchSports(), fetchMovies(), fetchWeather(), fetchMarkets(), fetchExtras()
  ]);

  const data = {
    lastUpdated: dayjs().format('MMMM D, YYYY – hh:mm A'),
    news,
    sports,
    entertainment,
    weather,
    markets,
    quote: extras.quote,
    fact: extras.fact,
    history: extras.history,
    trends: {
      title: 'Top Social Trends',
      items: ['#WhatHappenedToday', '#NewsUpdate', '#India', '#World', '#Inspiration']
    }
  };

  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

async function pushToGitHub() {
  execSync('git config --global user.email "sajid@example.com"');
  execSync('git config --global user.name "sajid-bot"');
  execSync('git pull');
  execSync('git add data.json');
  execSync('git commit -m "Auto update: ' + dayjs().format('YYYY-MM-DD HH:mm') + '" || echo "No changes"');
  execSync('git push');
}

app.get('/', (req, res) => res.send('WHT backend is live.')); // optional homepage

app.get('/run', async (req, res) => {
  try {
    await buildDataJson();
    await pushToGitHub();
    res.send('✅ Data updated and pushed to GitHub.');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Failed to update.');
  }
});

app.listen(PORT, () => console.log(`⚡ Server running at http://localhost:${PORT}`));
