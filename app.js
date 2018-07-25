'use strict'

const cheerio = require('cheerio')
const rp = require('request-promise')
const request = require('request')
const program = require('commander')
const path = require('path')
const fs = require('fs')
const Promise = require('bluebird')

// Commander declaration for controlling cli input
program
  .option('-o, --output <dir>', 'Directory to save books to')
  .parse(process.argv)

if (program.output === undefined) {
  // No output directory given
  console.error('No output directory specified. Please run `node app.js --help`')
  process.exit(1)
}

rp('https://goalkicker.com')
  .then((response) => {
    console.log('Scraping front page for all books')
    var $ = cheerio.load(response)
    var bookPages = []
    // Scrapes the page for the <a> tags inside of divs with the class .bookContainer
    // Generally each book page has its own "book container" on the home page
    $('.bookContainer a').each((i, element) => {
      bookPages.push(element.attribs.href)
    })

    return bookPages
  })
  .then((bookPages) => {
    return new Promise((resolve, reject) => {
      var urls = []
      console.log('Scraping each book page for download links')
      Promise.map(bookPages, (bookPage) => {
        // Hits the individual page for each book returned from the homepage scrape
        var url = `https://goalkicker.com/${bookPage}/`
        return rp(url)
          .then((response) => {
            var $ = cheerio.load(response)
            // Scrapes the page for the .download class (used to describe the download button) and then trims the onclick
            // inline JS for the href link for the pdf
            url += $('.download').attr('onclick').replace('location.href=', '').replace(/[']/g, '')
            urls.push(url)
          })
      }).then(() => {
        resolve(urls)
      })
        .catch((err) => reject(err))
    })
  })
  .then((urls) => {
    return Promise.map(urls, (url) => {
      // For each pdf download link
      console.log('Downloading ' + url.split('/').pop())
      // Uses the default request library over request-promise, as rp recommends not using rp for piping operations due to
      // memory issues for large responses
      var fileDownload = request(url).pipe(fs.createWriteStream(path.resolve(path.join(program.output, url.split('/').pop()))))
      fileDownload.on('finish', () => {
        console.log('Finished downloading ' + url.split('/').pop())
        return 1 // Signals to the Promise.map that this request is finished.
      })
    })
  })
  .catch((err) => {
    console.error(err)
  })
