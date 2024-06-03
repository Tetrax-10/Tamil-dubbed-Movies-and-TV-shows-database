import path from "path"

const userProfilePath = process.env.USERPROFILE ?? process.env.HOMEPATH

const Shared = {
    args: {}, // auto generated program arguments
    puppeteer: {
        path: {
            executable: path.join(process.env.LOCALAPPDATA, "/Google/Chrome SxS/Application/chrome.exe"),
            data: path.join(process.env.LOCALAPPDATA, "/Google/Chrome SxS/User Data"),
        },
    },
    isaiDub: {
        url: {
            main: "https://isaidub6.com",
            sub: {
                daily: "/movie/tamil-dubbed-movies-download",
                yearly: (year) => `/tamil-${year}-dubbed-movies`,
                alphabetical: "/tamil-atoz-dubbed-movies",
            },
        },
        selector: {
            titleName: "body > .f > a",
            pageNum: "body > .isaiminida > a[title*='Page ']",
        },
        path: {
            folder: {
                raw: "./out/isaiDub/raw",
            },
            db: "./out/isaiDub/db.json",
            correctTitleNames: "./public/isaiDub/correctTitleNames.json",
            removeTitles: "./public/isaiDub/removeTitles.json",
            duplicateTitle: path.join(userProfilePath, "Desktop/TDMTDB", "IsaiDub Duplicate Titles.json"),
            raw: {
                daily: "./out/isaiDub/raw/dailyDb.json",
                yearly: "./out/isaiDub/raw/yearlyDb.json",
                alphabetical: "./out/isaiDub/raw/alphabeticalDb.json",
                concatedDb: "./out/isaiDub/raw/concatedDb.json",
            },
        },
    },
    imdb: {
        selector: {
            titleName: "a.ipc-metadata-list-summary-item__t[href*='/title/']",
            year: "span.ipc-metadata-list-summary-item__li",
            list: {
                firstTitleElement: "div.lister-item-title a[href*='/title/tt']",
                positionInput: "input.element-position-input",
                saveListOrderButton: "a.lister-save-order",
                selectAllCheckbox: "input.element-check-total",
                deleteButton: "#delete_items",
                confirmDeleteButton: "input[value='DELETE']",
            },
        },
        path: {
            folder: "./out/imdb",
            db: "./out/imdb/db.json",
            mismatched: path.join(userProfilePath, "Desktop/TDMTDB", "IMDB Mismatched Titles.json"),
            addTitles: "./public/imdb/addTitles.json",
            unavailableTitles: "./public/imdb/unavailableTitles.json",
            cache: "./public/imdb/cache.json",
            listIdCache: "./public/imdb/listIdCache.json",
            csv: "./out/imdb/imdbOrLetterboxdList.csv",
            duplicateTitle: path.join(userProfilePath, "Desktop/TDMTDB", "IMDB Duplicate Titles.json"),
        },
        listId: "ls523475654",
    },
    tmdb: {
        path: {
            folder: "./out/tmdb",
            db: "./out/tmdb/db.json",
            cache: "./public/tmdb/cache.json",
            unavailableTitles: path.join(userProfilePath, "Desktop/TDMTDB", "TMDB Unavailable Titles.json"),
        },
        listId: "8301936",
    },
}

export default Shared
