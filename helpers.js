const fs = require("fs")
const csvParse = require("csv-parse")

const buildReferenceMap = (mappings, entries) => {
    console.log(mappings.filter(r => r.Onprem !== "-").length)
    console.log(new Set(mappings.filter(r => r.Onprem !== "-").map(r => r.Onprem)).size)
    const findEntry = (code, type) => {
        return entries.find(entry => entry.code === code && entry.type === type)
    }
    return mappings.reduce((map, row) => {
        const fullRef = row.Full === "-" ? "": findEntry(row.Full, "-FULL-")
        const liteRef = row.Lite === "-" ? "": findEntry(row.Lite, "-LITE-")
        const onpremRef = row.Onprem === "-" ? "": findEntry(row.Onprem, "-ONPREM-")

        const Full = fullRef && fullRef.key
        const Lite = liteRef && liteRef.key
        const Onprem = onpremRef && onpremRef.key

        if (Full) map[Full] = { Lite, Onprem }
        if (Lite) map[Lite] = { Full, Onprem }
        if (Onprem) map[Onprem] = { Lite, Full }
        return map
    }, { })
}

const generateMarkdown = ({ 
    code="", 
    question="",
    guidance="",
    noGuidance="", // no-guidance
    yesGuidance="", // yes-guidance
    analystReason="", // analyst-reason
    analystFollowup="", // analyst-followup
    cis="",
    iso27002="",
    nistcsf="",
    _800_171="", // 800-171
    _800_53="", // 800-53
    pci_321="", // pci-321
    trustedCi="", // trusted-ci
    references
}) => `
---
title: ${code}
description: "${question}"
---

import utilities from 'utilities?plugin=accentColor'
import { ArbitraryValues } from '@/components/ArbitraryValues'
import { BreakpointsAndMediaQueries } from '@/components/BreakpointsAndMediaQueries'
import { CustomizePluginColors } from '@/components/CustomizePluginColors'
import { HoverFocusAndOtherStates } from '@/components/HoverFocusAndOtherStates'

export const classes = { utilities }

## Official HECVAT question data

### Guidance

${guidance}

### If your answer is No

${noGuidance}

### If your answer is Yes

${yesGuidance}

### Analyst Reason

${analystReason}

### Analyst Follow-Up

${analystFollowup}

---

### Crosswalks
CIS: ${cis}
HIPAA: ${cis}
ISO: ${iso27002}
CSF: ${nistcsf}
800-181: ${_800_171}
800-53: ${_800_53}
trusted-ci: ${trustedCi}
pci: ${pci_321}

### References
${references}
`.trim()

const escapeCsvCell = (cell, placeholder="") => {
    if (cell !== 0 && !cell) return placeholder
    const str = String(cell).replace(/"/g, '""')
    const escapedVal = str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf("\n") !== -1 || str.indexOf("\r") !== -1 ? `"${str}"`: String(str)
    return escapedVal
}
const convertJsonToCsv = (data, customHeaders, placeholder, firstLine) => {
    const headers = customHeaders || Object.keys(data[0]).map(cell => escapeCsvCell(cell, placeholder))
    const headersStr = firstLine || headers.join(",")
    const csv = headersStr + "\r\n" + data.map(dat => headers.map(header => dat[header]).map(cell => escapeCsvCell(cell, placeholder))).map(escaped => escaped.join(",")).join("\r\n")
    return csv
}
const exportJsonToCsv = (path, data, customHeaders, placeholder, firstLine) => {
    const csv = convertJsonToCsv(data, customHeaders, placeholder, firstLine)
    fs.writeFileSync(path, csv)
}

const convertCsvToJson = csvStr => {
    return new Promise((resolve, reject) => {
        csvParse.parse(csvStr, { columns: true }, (err, records) => {
            if (!!err) return reject(err)
            resolve(records)
        })
    })
}

module.exports = {
    convertCsvToJson,
    generateMarkdown,
    buildReferenceMap,
    exportJsonToCsv
}