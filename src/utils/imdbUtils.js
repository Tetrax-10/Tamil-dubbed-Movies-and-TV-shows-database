import chalk from "chalk"
import ImdbScraper from "../helper/imdbScraper.js"
import Shared from "../shared/shared.js"
import Glob from "./glob.js"
import SortUtils from "./sortUtils.js"

const ImdbUtils = (() => {
    function processImdb({ forceRun = false } = {}) {
        if (!(Shared.args.process && Shared.args.database) && !forceRun) return

        console.log(chalk.blue("Processing IMDB..."))

        const imdb = Glob.get.json(Shared.imdb.path.db)
        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const imdbAddTitles = Glob.get.json(Shared.imdb.path.addTitles)
        const isaiDubDb = Glob.get.json(Shared.isaiDub.path.db)

        for (const titleKey in imdb) {
            // replaces imdb data with cached data from public/imdb/cache.json
            if (imdbCache.hasOwnProperty(titleKey)) {
                imdb[titleKey] = imdbCache[titleKey]
            }
        }

        // sorts and filters titles that are not present in IsaiDub database including manually added titles
        const sortedAndFiltered = {}
        for (const title of isaiDubDb) {
            if (imdb.hasOwnProperty(title)) {
                sortedAndFiltered[title] = imdb[title]
            }
        }

        // adds titles that are manually described in public/imdb/addTitles.json
        for (const titleKey in imdbAddTitles) {
            sortedAndFiltered[titleKey] = imdbAddTitles[titleKey]
        }

        Glob.write.json(Shared.imdb.path.db, sortedAndFiltered)

        console.log(chalk.blue("Done\n"))
    }

    async function reScrapeUnavailableTitles() {
        if (!Shared.args.refetch) return

        const imdb = Glob.get.json(Shared.imdb.path.db)
        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const imdbAddTitles = Glob.get.json(Shared.imdb.path.addTitles)
        const imdbUnavailableTitles = Glob.get.json(Shared.imdb.path.unavailableTitles)

        const reScrapableTitles = []

        for (const titleKey in imdb) {
            const [imdbName, imdbYear, imdbID] = imdb[titleKey]
            if (
                (imdbName === null || imdbYear === null || imdbID === null) &&
                !imdbCache.hasOwnProperty(titleKey) &&
                !imdbAddTitles.hasOwnProperty(titleKey) &&
                !imdbUnavailableTitles.includes(titleKey)
            ) {
                reScrapableTitles.push(titleKey)
            }
        }

        if (reScrapableTitles.length) {
            console.log(chalk.blue("Refetching unavailable titles from IMDB\n"))

            const reScrapedTitles = await ImdbScraper.scrape.titles({ titles: reScrapableTitles, log: true })

            for (const title of reScrapableTitles) {
                imdb[title] = reScrapedTitles[title]
            }

            console.log(chalk.blue(`\nRefetched ${Object.keys(reScrapedTitles).length} unavailable titles\n`))

            Glob.write.json(Shared.imdb.path.db, imdb)

            processImdb({ forceRun: true })
        }
    }

    async function updateImdb() {
        if (!(Shared.args.update && Shared.args.database)) return

        console.log(chalk.blue("IMDB: Checking for updates from IsaiDub DB..."))

        const imdb = Glob.get.json(Shared.imdb.path.db)
        const isaiDubDb = Glob.get.json(Shared.isaiDub.path.db)

        const latestIsaiDubTitles = []

        // gets only latest titleKeys from isaiDubDb
        for (const titleKey of isaiDubDb) {
            if (!imdb.hasOwnProperty(titleKey)) {
                latestIsaiDubTitles.push(titleKey)
            }
        }

        if (latestIsaiDubTitles.length) {
            console.log(chalk.blue("Fetching new IMDB titles from IsaiDub database\n"))

            const latestImdbTitles = await ImdbScraper.scrape.titles({ titles: latestIsaiDubTitles, log: true })

            // adds new title's data to IMDB
            for (const title of latestIsaiDubTitles) {
                imdb[title] = latestImdbTitles[title]
            }

            Glob.write.json(Shared.imdb.path.db, imdb)

            console.log(chalk.blue(`\nFetched ${Object.keys(latestImdbTitles).length} new titles\n`))

            processImdb({ forceRun: true })
        } else {
            console.log(chalk.blue("No new titles to update IMDB"))
        }
    }

    function createMismatchedImdb({ forceRun = false } = {}) {
        if (!Shared.args.mismatch && !forceRun) return

        console.log(chalk.blue("Checking mismatched Imdb data..."))

        const imdb = Glob.get.json(Shared.imdb.path.db)
        const imdbUnavailableTitles = Glob.get.json(Shared.imdb.path.unavailableTitles)
        const isaiDubDbCorrectTitleNames = Glob.get.json(Shared.isaiDub.path.correctTitleNames)
        const mismatchedImdb = {}

        for (const titleKey in imdb) {
            let name, year
            const [imdbName, imdbYear, imdbID] = imdb[titleKey]

            // gets correct title name and year if not found it just splits the key with "|"
            if (isaiDubDbCorrectTitleNames.hasOwnProperty(titleKey)) {
                ;[name, year] = isaiDubDbCorrectTitleNames[titleKey].split("|")
            } else {
                ;[name, year] = titleKey.split("|")
            }

            const areRequiredDataAvailable = name && year && imdbName && imdbYear && imdbID
            const isTitlesNotFoundOnImdb = imdbUnavailableTitles.includes(titleKey)

            // filters mismatched title key and values
            if (isTitlesNotFoundOnImdb) {
                continue
            } else if (!(areRequiredDataAvailable && name.toLowerCase() === imdbName.toLowerCase() && year === imdbYear)) {
                mismatchedImdb[titleKey] = imdb[titleKey]
            }
        }

        if (Object.keys(mismatchedImdb).length) {
            Glob.write.json(Shared.imdb.path.mismatched, mismatchedImdb)
            console.log(chalk.red("Mismatched data found !!!\n"))
            return mismatchedImdb
        } else {
            Glob.delete(Shared.imdb.path.mismatched)
            console.log(chalk.blue("No mismatched data\n"))
            return null
        }
    }

    function updateImdbCache() {
        if (!(Shared.args.update && Shared.args.cache)) return

        processImdb({ forceRun: true })

        const isaiDubDb = Glob.get.json(Shared.isaiDub.path.db)
        const imdb = Glob.get.json(Shared.imdb.path.db)

        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const imdbAddTitles = Glob.get.json(Shared.imdb.path.addTitles)
        const imdbUnavailableTitles = Glob.get.json(Shared.imdb.path.unavailableTitles)
        const isaiDubDbCorrectTitleNames = Glob.get.json(Shared.isaiDub.path.correctTitleNames)

        const mismatchedData = createMismatchedImdb({ forceRun: true })

        let isCachedDbUpdated = false

        console.log(chalk.blue("Checking for cacheable data...\n"))

        // adds new cacheable data to existing IMDB cache
        for (const titleKey in imdb) {
            if (!(imdbCache.hasOwnProperty(titleKey) || imdbAddTitles.hasOwnProperty(titleKey) || imdbUnavailableTitles.includes(titleKey) || mismatchedData?.hasOwnProperty(titleKey))) {
                let name, year
                const [imdbName, imdbYear] = imdb[titleKey]

                // gets correct title name and year if not found it just splits the key with "|"
                if (isaiDubDbCorrectTitleNames.hasOwnProperty(titleKey)) {
                    ;[name, year] = isaiDubDbCorrectTitleNames[titleKey].split("|")
                } else {
                    ;[name, year] = titleKey.split("|")
                }

                if (name === imdbName && year === imdbYear) {
                    imdbCache[titleKey] = imdb[titleKey]
                } else if (name.toLowerCase() === imdbName.toLowerCase() && year === imdbYear) {
                    isaiDubDbCorrectTitleNames[titleKey] = `${imdbName}|${imdbYear}`
                    imdbCache[titleKey] = imdb[titleKey]
                }

                console.log(chalk.green(`add: ${titleKey}`))
                isCachedDbUpdated = true
            }
        }

        // removes titles that are not present in isaiDubDb
        for (const titleKey in imdbCache) {
            if (!isaiDubDb.includes(titleKey)) {
                delete imdbCache[titleKey]

                console.log(chalk.red(`remove: ${titleKey}`))
                isCachedDbUpdated = true
            }
        }

        if (isCachedDbUpdated) {
            // sorts updated IMDB cache and saves it
            Glob.write.json(Shared.imdb.path.cache, SortUtils.customSortObject(imdbCache))
            Glob.write.json(Shared.isaiDub.path.correctTitleNames, SortUtils.customSortObject(isaiDubDbCorrectTitleNames))
            console.log(chalk.blue("\nIMDB cache updated\n"))
        } else {
            console.log(chalk.blue("No new data to update IMDB cache\n"))
        }
    }

    function createImdbCsvExport() {
        if (!Shared.args.csv) return

        console.log(chalk.blue("Creating CSV export file for Imdb ids..."))

        const imdb = Glob.get.json(Shared.imdb.path.db)
        let csvContent = "Const\n"

        // eslint-disable-next-line no-unused-vars
        for (const [, , imdbId] of Object.values(imdb)) {
            if (imdbId) csvContent += `${imdbId}\n`
        }

        Glob.write.file(Shared.imdb.path.csv, csvContent)

        console.log(chalk.blue("Done\n"))
    }

    return {
        db: {
            process: processImdb,
            update: updateImdb,
            createMismatched: createMismatchedImdb,
        },
        cache: {
            update: updateImdbCache,
        },
        misc: {
            reScrapeUnavailableTitles: reScrapeUnavailableTitles,
            createCsvExport: createImdbCsvExport,
        },
    }
})()

export default ImdbUtils
