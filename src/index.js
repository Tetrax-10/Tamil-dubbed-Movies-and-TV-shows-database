import { program } from "commander"

import Shared from "./shared/shared.js"
import IsaiDubScraper from "./helper/isaiDubScraper.js"
import IsaiDubUtils from "./utils/isaiDubUtils.js"
import ImdbScraper from "./helper/imdbScraper.js"
import ImdbUtils from "./utils/imdbUtils.js"
import TmdbHelper from "./helper/tmdbApiHelper.js"
import TmdbUtils from "./utils/tmdbUtils.js"
import SortUtils from "./utils/sortUtils.js"

// makes this program a cli (command line interface)
program
    // sources
    .option("-is, --isaiDub", "Activates IsaiDub functions")
    .option("-im, --imdb", "Activates IMDB functions")
    .option("-tm, --tmdb", "Activates TMDB functions")

    // common functions for all sources
    .option("-e, --extract", "Extracts respective source's data from online")
    .option("-db, --database", "Activates respective source's database functions")
    .option("-p, --process", "Used with --database to process respective source's database")
    .option("-up, --upload", "Uploads respective source's cache as Lists (fresh upload)(IMDB/TMDB)")
    .option("-c, --cache", "Activates cache functions for IMDB and TMDB")
    .option("-u, --update", "Activates update functions")
    .option("-l, --list", "Triggers IMDB's and TMDB's list functions")
    .option("-cl, --clear", "Clears respective source's list (IMDB/TMDB)")

    // IsaiDub specific functions
    .option("-d, --dailyUpdate", "Used with --extract and --isaiDub to scrape titles from daily updates page")
    .option("-y, --yearly", "Used with --extract and --isaiDub to scrape titles in yearly basis")
    .option("-al, --alphabetical", "Used with --extract and --isaiDub to scrape titles alphabetically")
    .option("-a, --all", "Used with --extract and --isaiDub to scrape all titles (dailyUpdate,yearly,alphabetical)")
    .option("-co, --concat", "Concats all IsaiDub database to a single database")

    // IMDB specific functions
    .option("-r, --refetch", "Refetches unavailable IMDB titles which failed while extracting")
    .option("-m, --mismatch", "Creates IMDB mismatched database for manual review")
    .option("-sy, --sync", "Syncs IMDB list with local cache")
    .option("-csv, --csv", "Creates CSV file that can be used to import all tamil dubbed titles in IMDB and Letterboxd list")

    // misc
    .option("-s, --sort", "Sorts files inside public folder")
    .option("-sc, --scheduler", "Tells program is runned by a scheduler")

    .parse(process.argv)

if (process.argv.length <= 2) {
    program.help() // display help and exit if no arguments provided
}

// main function
;(async () => {
    Shared.args = program.opts()

    if (Shared.args.isaiDub) {
        await IsaiDubScraper.scrape.db({ alphabetical: Shared.args.alphabetical, daily: Shared.args.dailyUpdate, yearly: Shared.args.yearly })
        IsaiDubUtils.db.concat()
        IsaiDubUtils.db.process()
        await IsaiDubUtils.db.update()
    }

    if (Shared.args.imdb) {
        await ImdbScraper.scrape.db()
        ImdbUtils.db.process()
        await ImdbUtils.misc.reScrapeUnavailableTitles()
        await ImdbUtils.db.update()
        ImdbUtils.db.createMismatched()
        ImdbUtils.cache.update()
        ImdbUtils.misc.createCsvExport()
        await ImdbScraper.list.clear()
        await ImdbScraper.list.upload()
        await ImdbScraper.list.update()
        await ImdbScraper.list.sync()
    }

    if (Shared.args.tmdb) {
        await TmdbHelper.fetch.db()
        TmdbUtils.processDb()
        await TmdbUtils.updateDb()
        TmdbUtils.updateCache()
        await TmdbHelper.list.clear()
        await TmdbHelper.list.freshUpload()
        await TmdbHelper.list.update()
    }

    SortUtils.customSortPublicFolder()
})()
