import puppeteer from "puppeteer-core"
import chalk from "chalk"

import Shared from "../shared/shared.js"

const Puppeteer = (() => {
    let browser, page

    async function puppeteerLaunchBrowser() {
        try {
            browser = await puppeteer.launch({
                headless: false,
                executablePath: Shared.puppeteer.path.executable,
                userDataDir: Shared.puppeteer.path.executable,
                defaultViewport: null,
                args: ["--start-maximized"],
                ignoreDefaultArgs: ["--disable-extensions"],
            })
            ;[page] = await browser.pages()

            return [browser, page]
        } catch (error) {
            if (error.message.includes("Failed to launch the browser process!")) {
                console.error(chalk.red("Error: Chrome is already running. Please close it and try again"))
            } else {
                console.error(chalk.red(error))
            }

            return [null, null]
        }
    }

    async function injectUsefulFunc() {
        // injects useful function to current page
        await page.evaluate(() => {
            // eslint-disable-next-line require-await
            window.waitForElement = async (selector, timeout = null, location = document.body) => {
                return new Promise((resolve) => {
                    if (document.querySelector(selector)) {
                        return resolve(document.querySelector(selector))
                    }

                    const observer = new MutationObserver(async () => {
                        if (document.querySelector(selector)) {
                            resolve(document.querySelector(selector))
                            observer.disconnect()
                        } else {
                            if (timeout) {
                                // eslint-disable-next-line require-await
                                async function timeOver() {
                                    return new Promise((resolve) => {
                                        setTimeout(() => {
                                            observer.disconnect()
                                            resolve(false)
                                        }, timeout)
                                    })
                                }
                                resolve(await timeOver())
                            }
                        }
                    })

                    observer.observe(location, {
                        childList: true,
                        subtree: true,
                    })
                })
            }
        })
    }

    return {
        launch: puppeteerLaunchBrowser,
        injectUsefulFunc: injectUsefulFunc,
    }
})()

export default Puppeteer
