import path from "path"

const userProfilePath = process.env.USERPROFILE ?? process.env.HOMEPATH

const Shared = {
    args: {}, // auto generated program arguments
    puppeteer: {
        path: {
            executable: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
            data: "C:/Users/ragha/AppData/Local/Microsoft/Edge/User Data",
        },
    },
    isaiDub: {
        url: {
            main: "https://isaidub.love/",
            sub: {
                daily: "/movie/tamil-dubbed-movies-download",
                yearly: (year) => `/tamil-${year}-dubbed-movies`,
                alphabetical: "/tamil-atoz-dubbed-movies",
            },
        },
        selector: {
            titleName: "body > div > .f > a",
            pageNum: "body .pagination a[title*='Page ']",
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
            titleName: "section[data-testid='find-results-section-title'] div.ipc-title--title >  a[href*='/title/tt']",
            year: "section[data-testid='find-results-section-title'] div.cli-title-metadata > span:first-child",
            list: {
                firstTitleElement: "section.ipc-page-section div.ipc-title--title >  a[href*='/title/tt'] > h3",
                positionInput: "input.element-position-input",
                saveListOrderButton: "a.lister-save-order",
                selectAllCheckbox: "input#list-edit-select-all-items",
                deleteButton: "button[data-testid='list-edit-delete-items']",
                confirmDeleteButton: "button[data-testid='dlp-delete-btn']",
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
        listId: "ls4154277024",
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
