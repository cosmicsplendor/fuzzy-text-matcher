const fs = require("fs")
const { convertCsvToJson, generateMarkdown, buildReferenceMap } = require("./helpers")

if (!fs.existsSync("./exports")) {
    fs.mkdirSync("./exports")
}

const extractMdxFromCsv = async ({ inputCsvPath, mappingsCsvPath }) => {
    const inputCsv = fs.readFileSync(inputCsvPath, { encoding: "utf-8" })
    const mappingsCsv = fs.readFileSync(mappingsCsvPath, { encoding: "utf-8" })
    const inputRows = await convertCsvToJson(inputCsv)
    const mappings = await convertCsvToJson(mappingsCsv)

    const referenceMap = buildReferenceMap(mappings, inputRows)
    const generateReferenceString = referenceObject => {
        if (!referenceObject) return "no relation"
        if (!Object.values(referenceObject).join("")) return "no relation"
        const types = Object.keys(referenceObject)
        const referenceLines = types.map(type => {
            const code = referenceObject[type]
            return `${type}: ${code ? code + ".mdx": "-"}`
        })
        const referenceString = referenceLines.join("\n")
        return referenceString
    }
    inputRows.forEach(row => {
        const { key, code, question, cis, iso27002, nistcsf, ...rest } = row
        const referenceObject = referenceMap[key]
        const references = generateReferenceString(referenceObject)
        const markdown = generateMarkdown({
            code, question, cis, iso27002, nistcsf,
            noGuidance: rest["no-guidance"],
            yesGuidance: rest["yes-guidance"],
            analystReason: rest["analyst-reason"],
            analystFollowup: rest["analyst-followup"],
            _800_171: rest["800-171"],
            _800_53: rest["800-53"],
            pci_321: rest["pci-321"],
            trustedCi: rest["trusted-ci"],
            references
        })
        fs.writeFileSync(`./exports/${key}.mdx`, markdown)
    })
}

extractMdxFromCsv({
    inputCsvPath: "./input.csv",
    mappingsCsvPath: "./mappings.csv"
})