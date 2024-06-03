import axios from "axios"
import chalk from "chalk"
import * as cheerio from "cheerio"

import Shared from "../shared/shared.js"
import Glob from "../utils/glob.js"
import LoggerUtils from "../utils/loggerUtils.js"

const IsaiDubScraper = (() => {
    const Logger = LoggerUtils.getLogger("IsaiDub")

    function scrapeTitlesFromAPage({ htmlData, log = false } = {}) {
        const $ = cheerio.load(htmlData)
        const titles = $(Shared.isaiDub.selector.titleName)
            .map((i, titleElement) => {
                const mediaTitle = $(titleElement).text().trim()
                if (log) console.log(chalk.green(mediaTitle))

                return mediaTitle
            })
            .get()

        return titles.length ? titles : []
    }

    function scrapeMaxNumPages(htmlData) {
        const $ = cheerio.load(htmlData)
        const lastPageElementValue = $(Shared.isaiDub.selector.pageNum).last().text()

        return lastPageElementValue ? lastPageElementValue : 1
    }

    async function scrapeAllIsaiDubTitlesFromUrl({ urlPath = "", allPages = true, log = false, page = 1, needMaxPages = false } = {}) {
        try {
            const response = await axios.get(Shared.isaiDub.url.main + urlPath + `/?get-page=${page}`)
            const titles = scrapeTitlesFromAPage({ htmlData: response.data, log: log })

            // scrapes all pages from given url path
            if (allPages) {
                const maxNumPages = scrapeMaxNumPages(response.data)

                for (let page = 2; page <= maxNumPages; page++) {
                    const moreResponse = await axios.get(Shared.isaiDub.url.main + urlPath + `/?get-page=${page}`)
                    const moreTitles = scrapeTitlesFromAPage({ htmlData: moreResponse.data, log: log })
                    titles.push(...moreTitles)
                }
            }

            if (needMaxPages) {
                return [titles, scrapeMaxNumPages(response.data)]
            } else {
                return titles
            }
        } catch (error) {
            Logger.error()
            console.error(chalk.red(`Error fetching data from ${Shared.isaiDub.url.main + urlPath}: ${chalk.gray(error)}`))
            return []
        }
    }

    async function scrapeIsaiDubDbByYears(fromYear, toYear) {
        const isaiDubDb = {}
        let totalNoOfTitles = 0

        for (let year = toYear; year >= fromYear; year--) {
            const title = await scrapeAllIsaiDubTitlesFromUrl({ urlPath: Shared.isaiDub.url.sub.yearly(year), allPages: true })
            isaiDubDb[year] = title

            const numOfTitles = title.length

            if (numOfTitles) {
                totalNoOfTitles += numOfTitles
                console.log(chalk.green(`${year}: ${numOfTitles} titles`))
            } else {
                console.log(chalk.yellow(`${year}: 0 titles`))
            }
        }

        return [isaiDubDb, totalNoOfTitles]
    }

    async function scrapeIsaiDubDbAlphabetically() {
        const isaiDubDb = []

        // Alphabets
        for (let charCode = "a".charCodeAt(0); charCode <= "z".charCodeAt(0); charCode++) {
            const currentChar = String.fromCharCode(charCode)
            const titles = await scrapeAllIsaiDubTitlesFromUrl({ urlPath: `${Shared.isaiDub.url.sub.alphabetical}/${currentChar}`, allPages: true })
            isaiDubDb.push(...titles)

            const numOfTitles = titles.length

            if (numOfTitles) {
                console.log(chalk.green(`${currentChar}: ${numOfTitles} titles`))
            } else {
                console.log(chalk.yellow(`${currentChar}: 0 titles`))
            }
        }

        // Numbers
        for (let num = 0; num <= 9; num++) {
            const titles = await scrapeAllIsaiDubTitlesFromUrl({ urlPath: `${Shared.isaiDub.url.sub.alphabetical}/${num}`, allPages: true })
            isaiDubDb.push(...titles)

            const numOfTitles = titles.length

            if (numOfTitles) {
                console.log(chalk.green(`${num}: ${numOfTitles} titles`))
            } else {
                console.log(chalk.yellow(`${num}: 0 titles`))
            }
        }

        return isaiDubDb
    }

    async function scrapeIsaiDubDbFromSource({ alphabetical = false, daily = false, yearly = false } = {}) {
        if (!Shared.args.extract) return

        Glob.create.folder(Shared.isaiDub.path.folder.raw)

        if (daily || Shared.args.all) {
            Logger.log("Scraping daily updates page...")

            const isaiDubDbDaily = await scrapeAllIsaiDubTitlesFromUrl({ urlPath: Shared.isaiDub.url.sub.daily, allPages: true, log: true })
            Glob.write.json(Shared.isaiDub.path.raw.daily, isaiDubDbDaily)

            console.log(chalk.blue(`\nDone! Scraped ${isaiDubDbDaily.length} titles\n`))
        }

        if (yearly || Shared.args.all) {
            console.log(chalk.blue("Scraping isaiDub in yearly order\n"))

            const [isaiDubDbYearly, totalNoOfTitles] = await scrapeIsaiDubDbByYears(1900, new Date().getFullYear())
            Glob.write.json(Shared.isaiDub.path.raw.yearly, isaiDubDbYearly)

            console.log(chalk.blue(`\nDone! Scraped ${totalNoOfTitles} titles\n`))
        }

        if (alphabetical || Shared.args.all) {
            console.log(chalk.blue("Scraping isaiDub in alphabetical order\n"))

            const isaiDubDbAlphabetical = await scrapeIsaiDubDbAlphabetically()
            Glob.write.json(Shared.isaiDub.path.raw.alphabetical, isaiDubDbAlphabetical)

            console.log(chalk.blue(`\nDone! Scraped ${isaiDubDbAlphabetical.length} titles\n`))
        }
    }

    return {
        scrape: {
            db: scrapeIsaiDubDbFromSource,
            url: scrapeAllIsaiDubTitlesFromUrl,
        },
    }
})()

export default IsaiDubScraper
