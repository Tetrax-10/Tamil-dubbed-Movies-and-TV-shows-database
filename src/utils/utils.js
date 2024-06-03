const Utils = (() => {
    function isSunday() {
        const indianDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        const currentDate = new Date(indianDate)

        return currentDate.getDay() === 0
    }

    return {
        isSunday: isSunday,
    }
})()

export default Utils
