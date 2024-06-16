import chalk from "chalk"
import colorize from "@pinojs/json-colorizer"

import Glob from "./glob.js"

const LoggerUtils = (() => {
    const Null = "/NULL/"

    function indentedLog(value, color) {
        if (typeof value !== "object") {
            console.log(`    ${chalk[color](value)}`)
            return
        }

        console.log(
            colorize(
                Glob.formatJson(value, { printWidth: 130 })
                    .split("\n")
                    .map((line) => `    ${line}`)
                    .join("\n"),
                {
                    colors: {
                        BRACE: "gray",
                        BRACKET: "gray",
                        STRING_KEY: color,
                        STRING_LITERAL: Array.isArray(value) ? color : "green",
                        NUMBER_LITERAL: Array.isArray(value) ? color : "green",
                    },
                }
            )
        )
    }

    function log(prefix, message = Null, value = Null) {
        if (message !== Null) console.log(chalk.blue(`[${prefix}] ${message}`))
        if (value !== Null) indentedLog(value, "blue")
    }

    function warn(prefix, message = Null, value = Null) {
        if (message !== Null) console.warn(chalk.yellow(`[${prefix}] ${message}`))
        if (value !== Null) indentedLog(value, "yellow")
    }

    function error(prefix, { msg: message = Null, err: error = Null, logErrMsg: logErrorMessage = false, value = Null } = {}) {
        message = message !== Null ? message : error.message
        if (error instanceof Error) {
            if (message !== Null) console.error(chalk.red(`[${prefix}] ${message ?? error.message}`))
            if (error !== Null)
                console.log(
                    chalk.red(
                        `${error.stack
                            .split("\n")
                            .slice(logErrorMessage ? 0 : 1)
                            .join("\n")}`
                    )
                )
        } else if (typeof error === "string") {
            console.error(chalk.red(`[${prefix}] ${error}`))
            if (typeof value === "object") {
                indentedLog(value, "red")
            }
        }
    }

    function addItem(item) {
        console.log(`    ${chalk.green(item)}`)
    }

    function removeItem(item) {
        console.log(`    ${chalk.red(item)}`)
    }

    function getLogger(prefix) {
        return {
            Null: Null,
            log: (...args) => log(prefix, ...args),
            warn: (...args) => warn(prefix, ...args),
            error: (...args) => error(prefix, ...args),
            addItem: addItem,
            removeItem: removeItem,
        }
    }

    return {
        getLogger: getLogger,
    }
})()

export default LoggerUtils
