import chalk from "chalk"

import Shared from "../shared/shared.js"
import Glob from "./glob.js"
import TmdbHelper from "../helper/tmdbApiHelper.js"
import SortUtils from "./sortUtils.js"

const TmdbUtils = (() => {
    function processTmdb({ forceRun = false } = {}) {
        if (!(Shared.args.process && Shared.args.database) && !forceRun) return

        console.log(chalk.blue("Processing TMDB..."))

        const imdb = Glob.get.json(Shared.imdb.path.db)
        const tmdb = Glob.get.json(Shared.tmdb.path.db)
        const tmdbCache = Glob.get.json(Shared.tmdb.path.cache)

        for (const titleKey in tmdb) {
            // replaces tmdb data with cached data from public/tmdb/cache.json
            if (tmdbCache.hasOwnProperty(titleKey)) {
                tmdb[titleKey] = tmdbCache[titleKey]
            }
        }

        // sorts and filters titles that are not present in imdb
        const sortedAndFiltered = {}
        for (const titleKey in imdb) {
            if (tmdb.hasOwnProperty(titleKey)) {
                sortedAndFiltered[titleKey] = tmdb[titleKey]
            }
        }

        Glob.write.json(Shared.tmdb.path.db, sortedAndFiltered)

        console.log(chalk.blue("Done\n"))
    }

    async function updateTmdb() {
        if (!(Shared.args.update && Shared.args.database)) return

        const imdb = Glob.get.json(Shared.imdb.path.db)
        const tmdb = Glob.get.json(Shared.tmdb.path.db)

        const latestImdbTitles = {}

        // gets only latest titleKeys from IMDB
        for (const titleKey in imdb) {
            if (imdb[titleKey][2] !== tmdb[titleKey]?.[2]) {
                latestImdbTitles[titleKey] = imdb[titleKey]
            }
        }

        if (Object.keys(latestImdbTitles).length) {
            console.log(chalk.blue("Fetching new TMDB titles from IMDB database\n"))

            const unavailableTitles = {}
            const latestTmdbTitles = await TmdbHelper.fetch.tmdbIds({ imdbData: latestImdbTitles, useCachedData: false, log: true })

            // adds new title's data to TMDB
            for (const titleKey in latestTmdbTitles) {
                tmdb[titleKey] = latestTmdbTitles[titleKey]

                const [tmdbId, type, imdbId] = latestTmdbTitles[titleKey]
                if (!(tmdbId && type && imdbId)) {
                    unavailableTitles[titleKey] = latestTmdbTitles[titleKey]
                }
            }

            // logs unavailable TMDB titles
            if (Object.keys(unavailableTitles).length) {
                console.log(chalk.red("Unavailable TMDB Titles present !!!\n"))
                Glob.write.json(Shared.tmdb.path.unavailableTitles, unavailableTitles)
            } else {
                Glob.delete(Shared.tmdb.path.unavailableTitles)
            }

            Glob.write.json(Shared.tmdb.path.db, tmdb)

            console.log(chalk.blue(`\nFetched ${Object.keys(latestTmdbTitles).length} new titles\n`))

            processTmdb({ forceRun: true })
        } else {
            console.log(chalk.blue("No new titles to update TMDB"))
        }
    }

    function updateTmdbCache() {
        if (!(Shared.args.update && Shared.args.cache)) return

        processTmdb({ forceRun: true })

        const tmdb = Glob.get.json(Shared.tmdb.path.db)

        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const tmdbCache = Glob.get.json(Shared.tmdb.path.cache)
        const imdbAddTitles = Glob.get.json(Shared.imdb.path.addTitles)
        const imdbUnavailableTitles = Glob.get.json(Shared.imdb.path.unavailableTitles)

        let isCachedDbUpdated = false
        let numTitlesAdded = 0
        let numTitlesRemoved = 0

        console.log(chalk.blue("Checking for cacheable data...\n"))

        // adds new cacheable data to existing TMDB cache from IMDB cache
        for (const titleKey in tmdb) {
            if (!tmdbCache.hasOwnProperty(titleKey) && (imdbCache.hasOwnProperty(titleKey) || imdbAddTitles.hasOwnProperty(titleKey) || imdbUnavailableTitles.includes(titleKey))) {
                tmdbCache[titleKey] = tmdb[titleKey]

                numTitlesAdded++
                console.log(chalk.green(`add: ${titleKey}`))
                isCachedDbUpdated = true
            }
        }

        // removes titles that are not present in IMDB cache data
        for (const titleKey in tmdbCache) {
            if (!(imdbCache.hasOwnProperty(titleKey) || imdbAddTitles.hasOwnProperty(titleKey) || imdbUnavailableTitles.includes(titleKey))) {
                delete tmdbCache[titleKey]

                numTitlesRemoved++
                console.log(chalk.red(`remove: ${titleKey}`))
                isCachedDbUpdated = true
            }
        }

        if (isCachedDbUpdated) {
            // sorts updated TMDB cache and saves it
            Glob.write.json(Shared.tmdb.path.cache, SortUtils.customSortObject(tmdbCache))
            if (numTitlesAdded) console.log(chalk.blue(`\nAdded ${numTitlesAdded} titles`))
            if (numTitlesRemoved) console.log(chalk.blue(`\nRemoved ${numTitlesRemoved} titles`))
            console.log(chalk.blue("\nTMDB cache updated\n"))
        } else {
            console.log(chalk.blue("\nNo new data to update TMDB cache\n"))
        }
    }

    return {
        processDb: processTmdb,
        updateDb: updateTmdb,
        updateCache: updateTmdbCache,
    }
})()

export default TmdbUtils
