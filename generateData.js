// Backend script here (already in canvas, not repeating for brevity)
// Backend script to fetch daily updates and push to GitHub
const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');
const dayjs = require('dayjs');

// Load from environment variables
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const MARKET_API_KEY = process.env.MARKET_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'sajidenam/whathappenedtoday';

const headers = { Authorization: `token ${GITHUB_TOKEN}` };

async function fetchNews() {
  const url = `https://newsapi.org/v2/top-headlines?country=in&pageSize=5&apiKey=${NEWS_API_KEY}`;
  const res = await axios.get(url);
  return {
    title: 'Top News',
    items: res.data.articles.map(a => `${a.title}`)
  };
}

async function fetchSports() {
  const url = `https://newsapi.org/v2/top-headlines?country=in&category=sports&pageSize=5&apiKey=${NEWS_API_KEY}`;
  const res = await axios.get(url);
  return {
    title: 'Sports Updates',
    items: res.data.articles.map(a => `${a.title}`)
  };
}

async function fetchWeather() {
  const cities = ['Delhi', 'Hyderabad'];
  const items = [];
  for (let city of cities) {
    const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
    const { temp } = res.data.main;
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
  const url = `https://financialmodelingprep.com/api/v3/quotes/index?apikey=${MARKET_API_KEY}`;
  const res = await axios.get(url);
  const indices = res.data.filter(item => ['^BSESN', '^NSEI'].includes(item.symbol));
  return {
    title: 'Market Snapshot',
    items: indices.map(i => `${i.name || i.symbol}: ${i.price}`)
  };
}

async function fetchQuoteFactHistory() {
  const [quote, fact, history] = await Promise.all([
    axios.get('https://api.quotable.io/random'),
    axios.get('https://uselessfacts.jsph.pl/random.json?language=en'),
    axios.get('https://history.muffinlabs.com/date')
  ]);

  return {
    quote: {
      title: 'Quote of the Day',
      content: `${quote.data.content} — ${quote.data.author}`
    },
    fact: {
      title: 'Quick Fact',
      content: fact.data.text
    },
    history: {
      title: 'Today in History',
      content: history.data.data.Events[0].text
    }
  };
}

async function buildData() {
  const [news, sports, entertainment, weather, markets, extras] = await Promise.all([
    fetchNews(),
    fetchSports(),
    fetchMovies(),
    fetchWeather(),
    fetchMarkets(),
    fetchQuoteFactHistory()
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
  execSync('git commit -m "Automated update: ' + dayjs().format('YYYY-MM-DD HH:mm') + '" || echo "No changes"');
  execSync('git push');
}

(async () => {
  await buildData();
  await pushToGitHub();
})();
