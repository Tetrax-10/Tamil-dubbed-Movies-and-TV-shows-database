import Shared from "../shared/shared.js"
import Glob from "./glob.js"

const SortUtils = (() => {
    function customSortArray(a, b) {
        const isaiDubDb = Glob.get.json(Shared.isaiDub.path.db)

        const indexA = isaiDubDb.indexOf(a)
        const indexB = isaiDubDb.indexOf(b)

        if (indexA === -1 && indexB === -1) {
            return 0
        } else if (indexA === -1) {
            return 1
        } else if (indexB === -1) {
            return -1
        }

        return indexA - indexB
    }

    function customSortObject(object) {
        return Object.fromEntries(Object.entries(object).sort((a, b) => customSortArray(a[0], b[0])))
    }

    function customSortPublicFolder() {
        if (!Shared.args.sort) return

        const isaiDubDbCorrectTitleNames = Glob.get.json(Shared.isaiDub.path.correctTitleNames)
        const isaiDubDbRemoveTitles = Glob.get.json(Shared.isaiDub.path.removeTitles)
        const imdbAddTitles = Glob.get.json(Shared.imdb.path.addTitles)
        const imdbCache = Glob.get.json(Shared.imdb.path.cache)
        const imdbUnavailableTitles = Glob.get.json(Shared.imdb.path.unavailableTitles)

        Glob.write.json(Shared.isaiDub.path.correctTitleNames, customSortObject(isaiDubDbCorrectTitleNames))
        Glob.write.json(Shared.isaiDub.path.removeTitles, isaiDubDbRemoveTitles.sort())
        Glob.write.json(Shared.imdb.path.addTitles, Object.fromEntries(Object.entries(imdbAddTitles).sort()))
        Glob.write.json(Shared.imdb.path.cache, customSortObject(imdbCache))
        Glob.write.json(Shared.imdb.path.unavailableTitles, imdbUnavailableTitles.sort(customSortArray))
    }

    return {
        customSortObject: customSortObject,
        customSortPublicFolder: customSortPublicFolder,
    }
})()

export default SortUtils
