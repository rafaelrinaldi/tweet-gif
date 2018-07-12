const fs = require('fs')
const path = require('path')
const http = require('axios')
const loading = require('loading-indicator')
const presets = require('loading-indicator/presets')
const { Chromeless } = require('chromeless')

let spinner

function startSpinner (text) {
  if (spinner) loading.stop(spinner)
  spinner = loading.start(text, { frames: presets.dots })
}

function stopSpinner () {
  loading.stop(spinner)
}

function getTweetURL (tweet) {
  // Make sure if a mobile URL is provided things still work properly
  return tweet.replace('mobile.', '')
}

function getTweetId (tweet) {
  return /\/(\d+)/.exec(tweet)[1]
}

async function resolve (tweet) {
  // Headless browser that simulates an user
  const chromeless = new Chromeless({
    implicitWait: true,
    scrollBeforeClick: true
  })

  startSpinner('Extracting GIF from tweet')

  const output = await chromeless
    // Relies on the awesome ezgif.com to generate the actual image file
    .goto('https://ezgif.com/optimize')
    .type(tweet, '[name=new-image-url]')
    .click('input[type=submit]')
    .setCookies('cookieconsent_dismissed', 'yes')
    .click('input[name=video-to-gif]')
    .wait('img[alt*=output]')
    .evaluate(() => document.querySelector('img[alt*=output]').src)
  await chromeless.end()
  return output
}

async function write (input, output) {
  return new Promise(async function (resolve, reject) {
    const stream = fs.createWriteStream(output)
    stream.on('error', reject)
    stream.on('finish', resolve)

    startSpinner('Downloading GIF file to disk')

    const request = await http(input, {
      method: 'get',
      url: input,
      responseType: 'stream'
    })

    request.data.pipe(stream)
  })
}

async function run () {
  const args = process.argv.slice(2)
  const tweet = getTweetURL(args[0])
  const tweetId = getTweetId(tweet)

  try {
    const url = await resolve(tweet)
    const output = path.resolve(__dirname, `tweet-${tweetId}.gif`)

    await write(url, output)

    stopSpinner()

    process.stdout.write(`${output}\n`)
    process.exit(0)
  } catch (error) {
    stopSpinner()
    process.stderr.write(
      `Something went wrong. Make sure you’ve provided an actual GIF and not a video.\n`
    )
    process.exit(1)
  }
}

run()
  .then(console.log)
  .catch(console.error)
