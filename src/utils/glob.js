import fs from "fs"
import path from "path"
import prettier from "prettier"

const Glob = (() => {
    const prettierConfig = getJsonObject("./.prettierrc.json")

    function createFolder(folderPath) {
        function createFolderRecursive(dirPath) {
            const parts = dirPath.split(path.sep)

            for (let i = 1; i <= parts.length; i++) {
                const currentPath = path.join.apply(null, parts.slice(0, i))

                if (!fs.existsSync(currentPath)) {
                    fs.mkdirSync(currentPath)
                }
            }
        }

        const parts = folderPath.split(path.sep)

        for (let i = 1; i <= parts.length; i++) {
            const currentPath = path.join.apply(null, parts.slice(0, i))
            createFolderRecursive(currentPath)
        }
    }

    function getFileContents(filePath) {
        return fs.readFileSync(filePath, "utf-8")
    }

    function getJsonObject(filePath) {
        try {
            return JSON.parse(getFileContents(filePath))
        } catch (err) {
            return null
        }
    }

    function formatContent(content, type, options = {}) {
        return prettier.format(content, {
            parser: type,
            ...prettierConfig,
            ...options,
        })
    }

    function formatJson(object, options = {}) {
        return formatContent(JSON.stringify(object), "json", options).slice(0, -1)
    }

    function writeJSON(filePath, object) {
        fs.writeFileSync(filePath, formatJson(object))
    }

    function writeFile(filePath, content) {
        fs.writeFileSync(filePath, content)
    }

    function deleteFile(filePath) {
        try {
            fs.unlinkSync(filePath)
            return true
        } catch (err) {
            return false
        }
    }

    return {
        create: {
            folder: createFolder,
        },
        get: {
            fileContents: getFileContents,
            json: getJsonObject,
        },
        write: {
            file: writeFile,
            json: writeJSON,
        },
        delete: deleteFile,
        formatJson: formatJson,
    }
})()

export default Glob
