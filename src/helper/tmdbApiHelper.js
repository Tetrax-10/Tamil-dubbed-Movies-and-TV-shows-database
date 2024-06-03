import axios from "axios"
import chalk from "chalk"
import "dotenv/config" // eslint-disable-line import/extensions

import Shared from "../shared/shared.js"
import Glob from "../utils/glob.js"

const TmdbHelper = (() => {
    const apiKey = process.env.API_KEY
    const authToken = process.env.AUTH_TOKEN

    async function fetchTmdbDataFromImdbId(imdbId) {
        try {
            const response = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`)
            return response
        } catch (err) {
            console.error(chalk.red("Error while fetching TMDB data from IMDB ID"))
        }
    }

    async function fetchTmdbMultiData(name) {
        try {
            const response = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(name)}`)
            return response
        } catch (err) {
            console.error(chalk.red("Error while fetching TMDB multi data from name"))
        }
    }

    async function fetchTmdbMovieData(name, year) {
        try {
            const response = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(name)}${year ? `&year=${year}` : ""}`)
            return response
        } catch (err) {
            console.error(chalk.red("Error while fetching TMDB movie data from name"))
        }
    }

    async function fetchTmdbTvData(name, year) {
        try {
            const response = await axios.get(`https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(name)}${year ? `&year=${year}` : ""}`)
            return response
        } catch (err) {
            console.error(chalk.red("Error while fetching TMDB tv data from name"))
        }
    }

    async function fetchTmdbByImdbId({ imdbData = {}, useCachedData = true, log = false } = {}) {
        const tmdbCache = Glob.get.json(Shared.tmdb.path.cache)

        const tmdb = {}

        const validResponseTypes = ["movie_results", "tv_results", "tv_episode_results"]

        for (const titleKey in imdbData) {
            // uses cached data
            if (tmdbCache.hasOwnProperty(titleKey) && useCachedData) {
                tmdb[titleKey] = tmdbCache[titleKey]
                continue
            }

            const [imdbTitle, imdbYear, imdbId] = imdbData[titleKey]

            if (!imdbId) {
                tmdb[titleKey] = [null, null, imdbId]

                if (log) console.log(chalk.red(`IMDB id not found: "${titleKey}"`))
                continue
            }

            const response = await fetchTmdbDataFromImdbId(imdbId)

            let responseType, tmdbData

            // checks if we got valid response
            for (const type of validResponseTypes) {
                if (response.data[type].length) {
                    responseType = type
                    break
                }
            }

            if (responseType) {
                tmdbData = response.data[responseType][0]
            } else {
                tmdb[titleKey] = [null, null, imdbId]

                if (log) console.log(chalk.red(`Title unavailable in TMDB: ${imdbTitle}, ${imdbYear}, ${imdbId}`))
                continue
            }

            const mediaType = tmdbData["media_type"]

            const tmdbId = (mediaType !== "tv_episode" ? tmdbData.id : tmdbData["show_id"]) + ""
            const type = mediaType === "movie" ? "movie" : "tv"

            tmdb[titleKey] = [tmdbId, type, imdbId]

            if (log) console.log(chalk.green(`${type}: ${imdbTitle} ${imdbYear}`))
        }

        return tmdb
    }

    async function fetchTmdb() {
        if (!Shared.args.extract) return

        const imdb = Glob.get.json(Shared.imdb.path.db)

        const tmdb = await fetchTmdbByImdbId({ imdbData: imdb, useCachedData: true, log: true })

        Glob.create.folder(Shared.tmdb.path.folder)
        Glob.write.json(Shared.tmdb.path.db, tmdb)
    }

    async function clearTmdbList({ forceRun = false } = {}) {
        if (!(Shared.args.clear && Shared.args.list) && !forceRun) return

        try {
            const response = await axios.request({
                method: "GET",
                url: `https://api.themoviedb.org/4/list/${Shared.tmdb.listId}/clear`,
                headers: {
                    accept: "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
            })

            if (response?.data?.status_code == 1) {
                console.log(chalk.blue("TMDB list cleared\n"))
                return true
            } else {
                return false
            }
        } catch (err) {
            console.error(chalk.red(err))
            return false
        }
    }

    async function addTitlesToTmdbList(titles) {
        try {
            const response = await axios.request({
                method: "POST",
                url: `https://api.themoviedb.org/4/list/${Shared.tmdb.listId}/items`,
                headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                data: {
                    items: titles,
                },
            })

            if (response?.data?.status_code == 1) {
                return true
            } else {
                return false
            }
        } catch (err) {
            return false
        }
    }

    async function freshUploadTmdbList() {
        if (!(Shared.args.upload && Shared.args.list)) return

        if (!(await clearTmdbList({ forceRun: true }))) return

        // waits for 5 sec so server can clear all the titles in the list
        await new Promise((resolve) => setTimeout(resolve, 5000))

        const tmdbCache = Glob.get.json(Shared.tmdb.path.cache)

        const titles = Object.values(tmdbCache)
            .map(([media_id, media_type]) => ({
                media_id: media_id,
                media_type: media_type,
            }))
            .reverse()

        const batchedItems = []
        const batchSize = 100

        // separate huge db in batches with respect to batchSize var
        for (let i = 0; i < titles.length; i += batchSize) {
            batchedItems.push(titles.slice(i, i + batchSize))
        }

        try {
            for (const [index, batchedItem] of batchedItems.entries()) {
                const isSuccess = await addTitlesToTmdbList(batchedItem)

                if (isSuccess) {
                    console.log(chalk.blue(`Batch ${index + 1} uploaded`))
                } else {
                    console.log(chalk.red(`Error while uploading Batch ${index + 1}`))
                    console.log(chalk.red("Update force stoped!\n"))
                    return
                }
            }

            console.log(chalk.blue("\nTMDB database cleanly uploaded\n"))
        } catch (err) {
            console.error(chalk.red("Request failed while clean updating TMDB list\n"))
        }
    }

    async function updateTmdbList() {
        if (!(Shared.args.update && Shared.args.list)) return

        console.log(chalk.blue("Updating TMDB list\n"))

        try {
            // get TMDB first page titles
            const response = await axios.request({
                method: "GET",
                url: `https://api.themoviedb.org/4/list/${Shared.tmdb.listId}?language=en-US&page=1`,
                headers: {
                    accept: "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
            })

            const firstTitleInTmdbList = [response.data?.results[0]?.["id"], response.data?.results[0]?.["media_type"]]

            if (Number.isInteger(firstTitleInTmdbList[0]) && typeof firstTitleInTmdbList[1] === "string") {
                const tmdbCache = Glob.get.json(Shared.tmdb.path.cache)

                const latestTitlesKeys = []
                const latestTitlesData = []

                // filters titles that are unavailable in the TMDB list
                for (let titleKey in tmdbCache) {
                    if (tmdbCache[titleKey][0] == firstTitleInTmdbList[0] && tmdbCache[titleKey][1] === firstTitleInTmdbList[1]) {
                        break
                    } else {
                        latestTitlesKeys.push(titleKey)
                        latestTitlesData.push({
                            media_id: tmdbCache[titleKey][0],
                            media_type: tmdbCache[titleKey][1],
                        })
                    }
                }

                if (latestTitlesData.length) {
                    const isSuccess = await addTitlesToTmdbList(latestTitlesData.reverse())

                    if (isSuccess) {
                        latestTitlesKeys.forEach((titleKey) => console.log(titleKey))
                        console.log(chalk.blue(`\nSuccessfully updated ${latestTitlesKeys.length} titles in TMDB list\n`))
                    } else {
                        console.log(chalk.red("Error while adding titles to TMDB list\n"))
                    }
                } else {
                    console.log(chalk.blue("No new titles to update TMDB list\n"))
                }
            } else {
                console.log(chalk.red("TMDB list is empty or data unfetchable\n"))
            }
        } catch (err) {
            console.error(chalk.red("Request failed while updating TMDB list"))
        }
    }

    return {
        fetch: {
            db: fetchTmdb,
            tmdbIds: fetchTmdbByImdbId,
            multiData: fetchTmdbMultiData, // unused
            movieData: fetchTmdbMovieData, // unused
            tvData: fetchTmdbTvData, // unused
        },
        list: {
            clear: clearTmdbList,
            freshUpload: freshUploadTmdbList,
            update: updateTmdbList,
        },
    }
})()

export default TmdbHelper
