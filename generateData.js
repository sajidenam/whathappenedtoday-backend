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
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const path = 'data.json';
  const branch = process.env.GITHUB_BRANCH;
  const token = GITHUB_TOKEN;

  const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'WhatHappenedToday-AutoUpdater'
    }
  });

  const content = fs.readFileSync('data.json', 'utf-8');
  const base64Content = Buffer.from(content).toString('base64');

  try {
    console.log('🔍 Checking if file exists...');
    const { data: existing } = await githubApi.get(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
    const sha = existing.sha;

    console.log('📝 Updating file via GitHub API...');
    await githubApi.put(`/repos/${owner}/${repo}/contents/${path}`, {
      message: `Auto update: ${dayjs().format('YYYY-MM-DD HH:mm')}`,
      content: base64Content,
      branch,
      sha
    });
    console.log('✅ GitHub file update complete');

  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log('📄 File not found — creating new data.json');
      await githubApi.put(`/repos/${owner}/${repo}/contents/${path}`, {
        message: `Initial data.json creation: ${dayjs().format('YYYY-MM-DD HH:mm')}`,
        content: base64Content,
        branch
      });
      console.log('✅ data.json created via GitHub API');
    } else {
      console.error('❌ GitHub API push failed:', err.message || err);
      throw err;
    }
  }
}

app.get('/', (req, res) => res.send('WHT backend is live.')); // optional homepage

app.get('/run', async (req, res) => {
  try {
    console.log('🟡 Starting buildDataJson...');
    await buildDataJson();
    console.log('✅ Data JSON built successfully.');

    console.log('🟡 Starting pushToGitHub...');
    await pushToGitHub();
    console.log('✅ GitHub push complete.');

    res.send('✅ Data updated and pushed to GitHub.');
  } catch (err) {
    console.error('🔥 Error during /run:');
    if (err.response) {
      console.error('📡 Status:', err.response.status);
      console.error('📩 Response:', err.response.data);
    } else {
      console.error(err.stack || err);
    }
    res.status(500).send('❌ Failed to update.');
  }
});

app.listen(PORT, () => console.log(`⚡ Server running at http://localhost:${PORT}`));
