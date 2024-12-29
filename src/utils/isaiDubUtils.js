import chalk from "chalk"
import IsaiDubScraper from "../helper/isaiDubScraper.js"
import Shared from "../shared/shared.js"
import Glob from "./glob.js"

const IsaiDubUtils = (() => {
    function cleanTitleName(name) {
        const excludeSubstring = ["collection", "duology", "trilogy", "pentalogy", "quadrilogy"]
        if (excludeSubstring.some((substring) => name.toLowerCase().includes(substring))) return null

        // Remove any information enclosed in parentheses or brackets
        name = name.replace(/\(.*\)|\[.*\]/g, "")

        // Remove season information in the format "Season xx" or "Season x"
        name = name.replace(/Season\s\d+/gi, "")

        // Remove "part" and convert it to the corresponding number
        name = name.replace(/part\s(\d+)/gi, "$1")

        // Remove any trailing dashes or spaces eg: "Title Name - " => "Title Name"
        name = name.replace(/[-\s]+$/, "")

        // Remove multiple spaces with single space eg: "Title   Name" => "Title Name"
        name = name.replace(/\s+/g, " ")

        return name
    }

    // "Pulp Fiction (1994)" => "Pulp Fiction|1994"
    function parseTitleString(name) {
        const match = name.match(/(.+) \((\d{4})\)/)

        if (match) {
            const titleName = match[1]
            const year = match[2]

            return `${cleanTitleName(titleName)}|${year}`
        } else {
            return `${cleanTitleName(name)}|`
        }
    }

    function concatAllIsaiDubSourcesDb({ forceRun = false } = {}) {
        if (!(Shared.args.concat && Shared.args.database) && !forceRun) return

        console.log(chalk.blue("Merging all scraped IsaiDub database into one..."))

        const isaiDubDbDailyDb = Array.from(new Set(Glob.get.json(Shared.isaiDub.path.raw.daily).reverse())).reverse()
        const isaiDubDbYearlyDb = [].concat(...Object.values(Glob.get.json(Shared.isaiDub.path.raw.yearly)).reverse())
        const isaiDubDbAlphabeticalDb = Glob.get.json(Shared.isaiDub.path.raw.alphabetical)

        const isaiDubConcatedDb = Array.from(new Set([...isaiDubDbDailyDb, ...isaiDubDbYearlyDb, ...isaiDubDbAlphabeticalDb]))
        Glob.write.json(Shared.isaiDub.path.raw.concatedDb, isaiDubConcatedDb)

        console.log(chalk.blue("Done\n"))
    }

    function processConcatedIsaiDubDb({ forceRun = false } = {}) {
        if (!(Shared.args.process && Shared.args.database) && !forceRun) return

        console.log(chalk.blue("Processing concated IsaiDub database"))
        const isaiDubDbRemoveTitles = Glob.get.json(Shared.isaiDub.path.removeTitles)

        // converts all titles into required formats like "title name|2023"
        const formattedConcatedTitles = Glob.get.json(Shared.isaiDub.path.raw.concatedDb).map((title) => parseTitleString(title))
        // filters if name = null and removes titles present in isaiDubDbRemoveTitles.json
        const filteredTitles = Array.from(new Set(formattedConcatedTitles.filter((title) => title.split("|")[0] !== "null" && !isaiDubDbRemoveTitles.includes(title))))

        Glob.write.json(Shared.isaiDub.path.db, filteredTitles)

        console.log(chalk.blue("Done\n"))
    }

    async function updateIsaiDubDb() {
        if (!(Shared.args.update && Shared.args.database)) return

        const isaiDubDailyDb = Glob.get.json(Shared.isaiDub.path.raw.daily)
        const latestTitle = isaiDubDailyDb[0]
        let latestTitles = []

        console.log(chalk.blue("Checking for new titles on IsaiDub website..."))

        const [firstPageLatestTitles, maxNumPage] = await IsaiDubScraper.scrape.url({ urlPath: Shared.isaiDub.url.sub.daily, allPages: false, needMaxPages: true })

        pageLoop: for (let page = 2; page <= maxNumPage; page++) {
            if (!firstPageLatestTitles.includes(latestTitle)) {
                const moreLatestTitles = await IsaiDubScraper.scrape.url({ urlPath: Shared.isaiDub.url.sub.daily, allPages: false, page: page })

                for (const title of moreLatestTitles) {
                    if (title !== latestTitle) {
                        latestTitles.push(title)
                    } else {
                        latestTitles.unshift(...firstPageLatestTitles)
                        break pageLoop
                    }
                }
            } else {
                latestTitles = firstPageLatestTitles.slice(0, firstPageLatestTitles.indexOf(latestTitle))
                break
            }
        }

        // check for duplicate data
        const isaiDubDb = Glob.get.json(Shared.isaiDub.path.db)
        const addTitles = Glob.get.json(Shared.imdb.path.addTitles)
        const duplicateTitle = []

        for (const [index, title] of latestTitles.entries()) {
            const parsedTitle = parseTitleString(title)
            if (isaiDubDb.includes(parsedTitle) || addTitles.hasOwnProperty(parsedTitle)) {
                duplicateTitle.push(title)
                latestTitles.splice(index, 1)
            }
        }

        if (duplicateTitle.length) {
            console.log(chalk.red("Found some duplicates:"))
            console.log(duplicateTitle)
            Glob.write.json(Shared.isaiDub.path.duplicateTitle, duplicateTitle)
        }

        if (latestTitles.length) {
            console.log(chalk.blue("Latest Titles:"))
            console.log(latestTitles)

            isaiDubDailyDb.unshift(...latestTitles)
            Glob.write.json(Shared.isaiDub.path.raw.daily, isaiDubDailyDb)

            console.log(chalk.blue("IsaiDub Daily Database Updated!"))

            concatAllIsaiDubSourcesDb({ forceRun: true })
            processConcatedIsaiDubDb({ forceRun: true })
        } else {
            console.log(chalk.blue("No new Tamil dubbed titles"))
        }
    }

    return {
        db: {
            concat: concatAllIsaiDubSourcesDb,
            process: processConcatedIsaiDubDb,
            update: updateIsaiDubDb,
        },
    }
})()

export default IsaiDubUtils
