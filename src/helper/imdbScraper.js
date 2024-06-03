import chalk from "chalk"

import Shared from "../shared/shared.js"
import Glob from "../utils/glob.js"
import Puppeteer from "../utils/puppeteer.js"
import SortUtils from "../utils/sortUtils.js"

const ImdbScraper = (() => {
    async function scrapeImdbByTitles({ titles = [], removeDuplicates = true, log = false } = {}) {
        let isBrowserLaunched = false
        let browser, page

        const imdbStringified = JSON.stringify(Glob.get.json(Shared.imdb.path.db) ?? {})
        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const imdbUnavailableTitles = Glob.get.json(Shared.imdb.path.unavailableTitles)
        const isaiDubDbCorrectTitleNames = Glob.get.json(Shared.isaiDub.path.correctTitleNames)

        const imdb = {}
        const imdbDuplicateTitles = {}

        for (const titleKey of titles) {
            // uses cached data
            if (imdbCache.hasOwnProperty(titleKey)) {
                imdb[titleKey] = imdbCache[titleKey]
                continue
            } else if (imdbUnavailableTitles.includes(titleKey)) {
                imdb[titleKey] = [null, null, null]
                continue
            }

            if (!isBrowserLaunched) {
                ;[browser, page] = await Puppeteer.launch()
                if (!(browser && page)) return
                isBrowserLaunched = true
            }

            let name, year

            // gets correct title name and year if not found it just splits the key with "|"
            if (isaiDubDbCorrectTitleNames.hasOwnProperty(titleKey)) {
                ;[name, year] = isaiDubDbCorrectTitleNames[titleKey].split("|")
            } else {
                ;[name, year] = titleKey.split("|")
            }

            try {
                await page.goto(`https://www.imdb.com/find/?s=tt&q=${encodeURIComponent(name)}${year ? `${encodeURIComponent(" " + year)}` : ""}`)
                await page.waitForSelector(Shared.imdb.selector.titleName, { timeout: 5000 })
                const imdbScrapeData = await page.evaluate((Shared) => {
                    const titleNameElement = document.querySelector(Shared.imdb.selector.titleName)
                    const titleYearElement = document.querySelector(Shared.imdb.selector.year)
                    const titleId = titleNameElement.getAttribute("href").match(/\/title\/(tt\d+)\/?/)?.[1] || null

                    return [titleNameElement.textContent, titleYearElement.textContent.replace(/(\d{4}).*/, "$1"), titleId]
                }, Shared)

                if (removeDuplicates && imdbStringified.includes(`"${imdbScrapeData[2]}"`)) {
                    imdbDuplicateTitles[titleKey] = imdbScrapeData
                    if (log) console.log(chalk.red(`duplicate: ${imdbScrapeData[0]}, ${imdbScrapeData[1]}, ${imdbScrapeData[2]}`))
                } else {
                    imdb[titleKey] = imdbScrapeData
                    if (log) console.log(chalk.green(`${imdbScrapeData[0]}, ${imdbScrapeData[1]}, ${imdbScrapeData[2]}`))
                }
            } catch (error) {
                imdb[titleKey] = [null, null, null]

                if (log) console.error(chalk.red(`Skipping URL for "${titleKey}" due to error: ${chalk.gray(error.message)}`))
            }
        }

        if (Object.keys(imdbDuplicateTitles).length) Glob.write.json(Shared.imdb.path.duplicateTitle, imdbDuplicateTitles)

        if (browser) await browser.close()

        return imdb
    }

    async function scrapeImdb() {
        if (!Shared.args.extract) return

        console.log(chalk.blue("Scraping IMDB Data for titles in IsaiDub Database\n"))

        const isaiDubDb = Glob.get.json(Shared.isaiDub.path.db)

        const imdb = await scrapeImdbByTitles({ titles: isaiDubDb, log: true })

        Glob.create.folder(Shared.imdb.path.folder)
        Glob.write.json(Shared.imdb.path.db, imdb)

        console.log(chalk.blue("\nDone\n"))
    }

    async function clearImdbList({ forceRun = false } = {}) {
        if (!(Shared.args.clear && Shared.args.list) && !forceRun) return

        const [browser, page] = await Puppeteer.launch()

        if (!(browser && page)) return

        try {
            await page.goto(`https://www.imdb.com/list/${Shared.imdb.listId}/edit`, { waitUntil: "domcontentloaded" })
            async function deleteItemsInCurrentPage() {
                await Puppeteer.injectUsefulFunc()
                return await page.evaluate(async (Shared) => {
                    const firstTitleElement = await window.waitForElement(Shared.imdb.selector.list.firstTitleElement, 1000)
                    if (firstTitleElement) {
                        const selectAllCheckbox = await window.waitForElement(Shared.imdb.selector.list.selectAllCheckbox, 1000)
                        const deleteButton = await window.waitForElement(Shared.imdb.selector.list.deleteButton, 1000)
                        const confirmDeleteButton = await window.waitForElement(Shared.imdb.selector.list.confirmDeleteButton, 1000)
                        selectAllCheckbox.click()
                        deleteButton.click()
                        confirmDeleteButton.click()

                        return true
                    } else {
                        return false
                    }
                }, Shared)
            }

            return new Promise((resolve) => {
                page.on("load", async () => {
                    const isFirstTitleElementFound = await deleteItemsInCurrentPage()
                    if (!isFirstTitleElementFound) {
                        await browser.close()
                        const ImdbListIdCache = Glob.get.json(Shared.imdb.path.listIdCache)
                        if (ImdbListIdCache) Glob.delete(Shared.imdb.path.listIdCache)
                        console.log(chalk.blue("Imdb list cleared\n"))
                        resolve(true)
                    }
                })
            })
        } catch (error) {
            console.error(chalk.red(error))

            if (browser) {
                await browser.close()
                console.log(chalk.red("Chrome forcibly closed due to errors"))
            }

            return false
        }
    }

    // list_item_id, list_id
    async function addTitlesToImdbList({ titles = {}, page = null } = {}) {
        try {
            await page.exposeFunction("addTitleCallback", (name, isSuccess) => (isSuccess ? console.log(chalk.green(name)) : console.log(chalk.red(name))))
            const imdbListIdRes = await page.evaluate(
                async ([Shared, titles]) => {
                    const imdbListIds = {}

                    const payloadElement = document.querySelector("#main > input")

                    let movieKeys = Object.keys(titles)
                    let count = 0

                    function sendRequest(titleKey) {
                        return new Promise((resolve) => {
                            let titleValue = titles[titleKey]
                            let [imdbName, imdbYear, imdbId] = titleValue

                            const xhr = new XMLHttpRequest()
                            xhr.onreadystatechange = async (event) => {
                                if (event.target.readyState === 4 && event.target.status === 200) {
                                    const data = JSON.parse(event.target.response)
                                    imdbListIds[titleKey] = [data["list_item_id"], imdbId]
                                    window.addTitleCallback(`${imdbName} ${imdbYear}`, true)

                                    count++
                                    if (count < movieKeys.length) {
                                        await sendRequest(movieKeys[count])
                                        resolve()
                                    } else {
                                        resolve()
                                    }
                                }
                            }
                            xhr.open("POST", `https://www.imdb.com/list/${Shared.imdb.listId}/${imdbId}/add`, true)
                            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded")
                            xhr.send(`${payloadElement.id}=${payloadElement.value}`)
                        })
                    }

                    await sendRequest(movieKeys[count])

                    if (movieKeys.length === Object.keys(imdbListIds).length) {
                        return imdbListIds
                    } else {
                        return null
                    }
                },
                [Shared, titles]
            )

            if (imdbListIdRes) {
                const ImdbListIdCache = Glob.get.json(Shared.imdb.path.listIdCache) ?? {}
                const sortedListIdCache = SortUtils.customSortObject({ ...ImdbListIdCache, ...imdbListIdRes })
                Glob.write.json(Shared.imdb.path.listIdCache, sortedListIdCache)

                return [imdbListIdRes, sortedListIdCache]
            } else {
                throw new Error("Failed to add some titles to IMDN list")
            }
        } catch (error) {
            console.error(chalk.red(error))
            if (!error.message.includes("Failed to add ")) {
                console.error(chalk.red("\nFailed to add titles to IMDB list\n"))
            }
            return [false, false]
        }
    }

    async function reorderImdbListItems({ postData = "", page = null } = {}) {
        try {
            await page.evaluate(
                async ([Shared, postData]) => {
                    const payloadElement = document.querySelector("#main > input")
                    await fetch(`https://www.imdb.com/list/${Shared.imdb.listId}/edit/reorderitems`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                        body: `newListOrder={${postData}}&${payloadElement.id}=${payloadElement.value}`,
                    })
                },
                [Shared, postData]
            )

            console.log(chalk.blue("Reordered IMDB list\n"))
            return true
        } catch (err) {
            console.error(chalk.red("Failed to reorder titles in IMDB list"))
            return false
        }
    }

    async function freshUploadImdbList() {
        if (!(Shared.args.upload && Shared.args.list)) return

        if ((await clearImdbList({ forceRun: true })) === false) return

        await new Promise((resolve) => setTimeout(resolve, 1000))

        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const addTitles = Glob.get.json(Shared.imdb.path.addTitles)

        const imdbList = { ...imdbCache, ...addTitles }

        // splits huge imdbCache into small batches
        let batchSize = 100
        const batchedItems = []
        const titleKeys = Object.keys(imdbList)
        for (let i = 0; i < titleKeys.length; i += batchSize) {
            const chunkKeys = titleKeys.slice(i, i + batchSize)
            const chunkObject = {}
            for (const titleKey of chunkKeys) {
                chunkObject[titleKey] = imdbList[titleKey]
            }
            batchedItems.push(chunkObject)
        }

        try {
            for (const [index, batchedItem] of batchedItems.entries()) {
                const [browser, page] = await Puppeteer.launch()
                if (!(browser && page)) return

                try {
                    await page.goto(`https://www.imdb.com/list/${Shared.imdb.listId}/edit`)
                    const [imdbListIdRes] = await addTitlesToImdbList({ titles: batchedItem, page: page })
                    if (imdbListIdRes === false) return
                    console.log(chalk.blue(`\nBatch ${index + 1} uploaded\n`))
                } catch (error) {
                    console.error(chalk.red(error))
                    throw new Error(`\nError while uploading Batch ${index + 1}`)
                } finally {
                    await browser.close()
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                }
            }

            console.log(chalk.blue("All titles uploaded to IMDB list\n"))
        } catch (error) {
            console.log(chalk.red(error))
        }
    }

    // adds new titles from imdb
    async function updateImdbList() {
        if (!(Shared.args.update && Shared.args.list)) return

        const [browser, page] = await Puppeteer.launch()

        if (!(browser && page)) return

        try {
            // gets first title id in IMDB list
            await page.goto(`https://www.imdb.com/list/${Shared.imdb.listId}/edit?sort=list_order,asc`)
            await Puppeteer.injectUsefulFunc()
            const firstTitleIdInImdbList = await page.evaluate(async (Shared) => {
                const firstTitleElement = await window.waitForElement(Shared.imdb.selector.list.firstTitleElement, 10000)
                return firstTitleElement.getAttribute("href").match(/\/title\/(tt\d+)\/?/)?.[1] || null
            }, Shared)

            // gets last title id in IMDB list
            await page.goto(`https://www.imdb.com/list/${Shared.imdb.listId}/edit?sort=list_order,desc`)
            await Puppeteer.injectUsefulFunc()
            const lastTitleIdInImdbList = await page.evaluate(async (Shared) => {
                const lastTitleElement = await window.waitForElement(Shared.imdb.selector.list.firstTitleElement, 10000)
                return lastTitleElement.getAttribute("href").match(/\/title\/(tt\d+)\/?/)?.[1] || null
            }, Shared)

            if (firstTitleIdInImdbList && lastTitleIdInImdbList) {
                const imdbCache = Glob.get.json(Shared.imdb.path.cache)
                const imdbAddTitles = Glob.get.json(Shared.imdb.path.addTitles)
                const imdbListIdCache = Glob.get.json(Shared.imdb.path.listIdCache)

                const latestCacheTitles = {}
                const latestAddTitles = {}

                // gets latest IMDB cache titles that are not present in the list
                for (const titleKey in imdbCache) {
                    if (imdbCache[titleKey][2] !== firstTitleIdInImdbList && !imdbListIdCache.hasOwnProperty(titleKey)) {
                        latestCacheTitles[titleKey] = imdbCache[titleKey]
                    } else {
                        break
                    }
                }

                // gets latest manually added titles (addTitles.json) that are not present in the list
                let isLastTitleFound = false
                for (const titleKey in imdbAddTitles) {
                    if (isLastTitleFound) {
                        latestAddTitles[titleKey] = imdbAddTitles[titleKey]
                    }
                    if (imdbAddTitles[titleKey][2] === lastTitleIdInImdbList) {
                        isLastTitleFound = true
                    }
                }

                const totalLatestTitles = { ...latestAddTitles, ...latestCacheTitles }

                if (!Object.keys(totalLatestTitles).length) {
                    console.log(chalk.blue("No new titles to update IMDB list\n"))
                    return
                }

                // adds titles to IMDB list
                const [imdbListIdRes] = await addTitlesToImdbList({ titles: totalLatestTitles, page: page })

                if (imdbListIdRes !== false) {
                    console.log(chalk.blue("\nAdded new titles to IMDB list\n"))
                } else {
                    return
                }

                const latestCacheTitlesKeys = Object.keys(latestCacheTitles)

                if (!latestCacheTitlesKeys.length) return

                // "123":1,"456":2
                const postData = latestCacheTitlesKeys.map((latestCacheTitlesKey) => `"${imdbListIdRes[latestCacheTitlesKey][0]}":1`).join(",")
                // reorder titles in IMDB list
                await reorderImdbListItems({ postData: postData, page: page })
            } else {
                throw new Error("Failed to fetch first and last title in IMDB list")
            }
        } catch (error) {
            console.error(chalk.red(error))
            console.log(chalk.red("Chrome forcibly closed due to errors"))
        } finally {
            if (browser) {
                await browser.close()
            }
        }
    }

    // syncs whats edited or removed
    async function syncImdbList() {
        if (!(Shared.args.sync && Shared.args.list)) return

        const imdbListIdCache = Glob.get.json(Shared.imdb.path.listIdCache)
        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const addTitles = Glob.get.json(Shared.imdb.path.addTitles)
        const removedTitles = {}
        let updatedTitles = {}
        const missedTitles = {}

        const localCache = { ...imdbCache, ...addTitles }

        // get cache data that need to be synced
        for (const titleKey in imdbListIdCache) {
            if (!localCache.hasOwnProperty(titleKey)) {
                removedTitles[titleKey] = imdbListIdCache[titleKey]
                delete imdbListIdCache[titleKey]
            } else if (imdbListIdCache[titleKey][1] !== localCache[titleKey]?.[2]) {
                updatedTitles[titleKey] = localCache[titleKey]
            }
        }

        for (const titleKey in imdbCache) {
            if (!imdbListIdCache.hasOwnProperty(titleKey)) {
                missedTitles[titleKey] = imdbCache[titleKey]
            }
        }

        console.log(chalk.blue("Syncing Imdb list...\n"))

        if (!Object.keys({ ...removedTitles, ...updatedTitles, ...missedTitles }).length) {
            console.log(chalk.blue("Imdb list is already in sync with Local cache\n"))
            return
        }

        const [browser, page] = await Puppeteer.launch()
        if (!(browser && page)) return
        await page.goto(`https://www.imdb.com/list/${Shared.imdb.listId}/edit`)

        try {
            const removedTitlesKeys = Object.keys(removedTitles)
            let updatedTitlesKeys = Object.keys(updatedTitles)

            if (removedTitlesKeys.length || updatedTitlesKeys.length) {
                console.log(chalk.blue("Deleting titles...\n"))
                // li123,li456
                const removedTitlesPostData = removedTitlesKeys.map((removedTitle) => `li${removedTitles[removedTitle][0]}`).join(",")
                const updatedTitlesPostData = updatedTitlesKeys.map((updatedTitle) => `li${imdbListIdCache[updatedTitle][0]}`).join(",")
                const postData =
                    removedTitlesPostData && updatedTitlesPostData ? [removedTitlesPostData, updatedTitlesPostData].join(",") : removedTitlesPostData ? removedTitlesPostData : updatedTitlesPostData
                // deletes items in IMDB list
                try {
                    await page.evaluate(
                        async ([Shared, postData]) => {
                            const payloadElement = document.querySelector("#main > input")
                            await fetch(`https://www.imdb.com/list/items/${Shared.imdb.listId}/delete`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded",
                                },
                                body: `items=${postData}&${payloadElement.id}=${payloadElement.value}`,
                            })
                        },
                        [Shared, postData]
                    )

                    Glob.write.json(Shared.imdb.path.listIdCache, SortUtils.customSortObject(imdbListIdCache))
                    console.log(removedTitlesKeys)
                    console.log(chalk.blue("\nAbove titles have been deleted from IMDB list\n"))
                } catch (error) {
                    throw new Error("Failed to remove titles from IMDB list\n")
                }
            }

            updatedTitles = { ...updatedTitles, ...missedTitles }
            updatedTitlesKeys = updatedTitlesKeys.concat(Object.keys(missedTitles))

            if (updatedTitlesKeys.length) {
                console.log(chalk.blue("Syncing existing and new titles to IMDB list...\n"))

                // adds titles to IMDB list
                const [imdbListIdRes, sortedListIdCache] = await addTitlesToImdbList({ titles: updatedTitles, page: page })

                if (imdbListIdRes !== false) {
                    console.log(chalk.blue("\nEdited titles have been updated in IMDB list\n"))
                } else {
                    return
                }

                const sortedListIdCacheKeys = Object.keys(sortedListIdCache)
                // "123":1,"456":2
                const postDatas = updatedTitlesKeys.map((updatedTitlesKey) => `"${[imdbListIdRes[updatedTitlesKey][0]]}":${sortedListIdCacheKeys.indexOf(updatedTitlesKey) + 1}`)
                // reorder titles in IMDB list
                for (const postData of postDatas) {
                    await reorderImdbListItems({ postData: postData, page: page })
                }
            }
        } catch (error) {
            console.error(chalk.red(error))
            console.log(chalk.red("Chrome forcibly closed due to errors"))
        } finally {
            if (browser) {
                await browser.close()
            }
        }
    }

    return {
        scrape: {
            db: scrapeImdb,
            titles: scrapeImdbByTitles,
        },
        list: {
            clear: clearImdbList,
            upload: freshUploadImdbList,
            update: updateImdbList,
            sync: syncImdbList,
        },
    }
})()

export default ImdbScraper
