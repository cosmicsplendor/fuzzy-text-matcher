const fs = require("fs")
const { convertCsvToJson, exportJsonToCsv } = require("../../helpers")

const stopWords = require("./stopWords.json")

const computeVecLen = vec => {
    const coords = Object.values(vec)
    const sqLen = coords.reduce((sqLen, coord) => {
        return sqLen + coord * coord
    }, 0)
    const len = Math.sqrt(sqLen)
    return len
}

const computeCosine = (vec1, vec2) => {
    const vec1Axes = Object.keys(vec1)
    const vec2Axes = Object.keys(vec2)

    const unionAxes = Array.from(new Set(vec1Axes.concat(vec2Axes)))
    const dotProduct = unionAxes.reduce((prod, axis) => {
        const coord1 = vec1[axis] || 0
        const coord2 = vec2[axis] || 0
        return prod + (coord1 * coord2)
    }, 0)
    const vec1Len = computeVecLen(vec1)
    const vec2Len = computeVecLen(vec2)

    const cosine = dotProduct / (vec1Len * vec2Len)
    return cosine
}

const generateNgrams = (array, n) => {
    const ngrams = []
    const numOfNgrams = array.length - (n - 1)
    for (let i = 0, max = numOfNgrams; i < max; i++) {
        const ngram = array.slice(i, i + n).join(" ")
        ngrams.push(ngram.trim())
    }
    return ngrams
}


const filterStopWords = tokens => {
    return tokens.filter(token => {
        return stopWords.indexOf(token) === -1
    })
}

const tokenize = (doc, n=1) => {
    const tokens = doc.toLowerCase().split(/[^\w]+/)
    const cleanTokens = filterStopWords(tokens)
    if (n === 1) return cleanTokens
    const ngramTokens = generateNgrams(cleanTokens, n)
    return ngramTokens
}

const computeIdf = (() => {
    const cache = {}
    return (token, docs) => {
        if (cache[token]) return cache[token]
        const numOfDocsWithTokens = docs.reduce((count, doc) => { // inverse documents count
            const docTokens = tokenize(doc.text, token.split(" ").length)
            const found = docTokens.indexOf(token) !== -1
            return found ? count + 1: count
        }, 0) || 1
        const numOfDocs = docs.length
        const idf = numOfDocs / numOfDocsWithTokens

        cache[token] = idf

        return idf
    }
})();

const generateTfidfVector = (tokens, docs, n=1) => {
    const dfHash = {}
    const tdfidfHash = {}
    tokens.forEach(token => {
        dfHash[token] = dfHash[token] ? dfHash[token] + 1: 1
    })
    // const uniqueTokensLen = Object.keys(dfHash).length
    for (const token in dfHash) {
        const df = dfHash[token]
        const idf = computeIdf(token, docs, n)
        tdfidfHash[token] = df * Math.log(idf)
    }
    return tdfidfHash
}

const str = fs.readFileSync("./input.csv", { encoding: "utf-8" })

const mapRowToDocs = row => {
    const { key, code, type, question, category, guidance, offering } = row
    const text = [ 
        question,
        // category,
        guidance,
        // offering,
        row["yes-guidance"],
        row["no-guidance"],
        // row["service-name"],
        row["analyst-reason"],
        row["analyst-followup"]
    ].join("--").replace(/\?|\.|\,|\"|\'/g, " ").replace(/\//g, " ")
    return { key, code, type, text }
}
const buildMapping = (allDocs, docs) => {
    const mappingsArray = docs.map(({ tfidfVector }) => {
        const scoredDocs = allDocs
            .map(doc => {
                const score = computeCosine(tfidfVector, doc.tfidfVector)
                return {
                    key: doc.key,
                    code: doc.code,
                    type: doc.type,
                    score
                }
            })
            // .sort((a, b) => b.score - a.score)
            // .filter(doc => doc.score > 0.5).slice(0, 3)
        const mappingRow = scoredDocs
            .reduce((row, scoredDoc) => {
                const { code, score } = scoredDoc
                const type = scoredDoc.type && scoredDoc.type.replace(/\-/g, "")
                const cell = row[type]
                if (cell.score < score) row[type] = { code, score }
                return row
            }, { FULL: { score: 0 }, LITE: { score: 0 }, ONPREM: { score: 0 } })

        return mappingRow
    }).map(row => {
        Object.keys(row).forEach(type => {
            const { score, code } = row[type]
            row[type] = score > 0.4 ? { score, code }: { }
        })
        return row
    })
    const sanitizedMappingArray = mappingsArray.map((row, index) => {
        const newRow = { }
        Object.keys(row).forEach((type) => {
            const { score, code } = row[type]
            const outScored = mappingsArray.find((r, i) => {
                return index !== i && r[type].code === code && r[type].score > score
            })
            if (outScored) newRow[type] = ""
            else {
                newRow[type] = code
                newRow[`${type}_SCORE`] = score && (score * 100).toFixed(0) 
            }
        })
        return newRow
    })
    return sanitizedMappingArray
}
const buildMappingsByType = (allDocs, docsByType) => {
    const types = Object.keys(docsByType)
    const mappingsByType = types.reduce((mappingsByType, type) => {
        console.log(`Generating mappings with ${type.toUpperCase()} as an index. .`)
        const curDocs = docsByType[type]
        const mapping = buildMapping(allDocs, curDocs)
        return {
            ...mappingsByType,
            [type]: mapping,
        }
    }, { })
    return mappingsByType
}
const mapTypeToCsvHeader = type => {
    const types = [ "Full", "Lite", "Onprem" ]
    const header = [ type ].concat(
        types.
        filter(t => t !== type)
        .reduce((withScores, type) => {
            return [
                ...withScores,
                type,
                `${type}_Score`
            ]
        }, [])
    )
    const headerStr = header.join(",")
    const headerArray = header.map(type => type.toUpperCase())
    return { headerArray, headerStr}
}
convertCsvToJson(str).then(rows => {
    const startedAt = Date.now()
    const allDocs = rows.map(mapRowToDocs)
    // const fullKeys = rows.filter(row => row.type === "-FULL-").slice(0,1)
    console.log("tokenizing and computing tfidf vectors")
    const n = 1
    const docsWithTfidfVec = allDocs.map((doc, i) => {
        const tokens = tokenize(doc.text, n)
        const tfidfVector = { 
            ...generateTfidfVector(tokens, allDocs, n),
            ...generateTfidfVector( tokens, allDocs, n+1)
        }

        console.log(`ngram token vectorization progress: ${(100 * i / allDocs.length).toFixed(3)}%`)

        return { 
            key: doc.key,
            code: doc.code,
            type: doc.type,
            tfidfVector
        }
    })
    const docsWithTfidfVecByType = {
        Full: docsWithTfidfVec.filter(d => d.type === "-FULL-"),
        Lite: docsWithTfidfVec.filter(d => d.type === "-LITE-"),
        Onprem: docsWithTfidfVec.filter(d => d.type === "-ONPREM-"),
    }
    const mappingsByType = buildMappingsByType(docsWithTfidfVec, docsWithTfidfVecByType)
    if (!fs.existsSync("./mappings")) {
        fs.mkdirSync("./mappings")
    }
    for (const type in mappingsByType) {
        const mapping = mappingsByType[type]
        const { headerArray, headerStr } = mapTypeToCsvHeader(type)
        exportJsonToCsv(`./mappings/${type}-indexed-mappings.csv`, mapping, headerArray, "-", headerStr)
    }
    const finishedAt = Date.now()
    const ms = finishedAt - startedAt
    const seconds = Math.round(ms / 1000)
    const minutes = Math.round(seconds / 60)
    const remainderSeconds = seconds % 60
    console.log(`Finished in: ${minutes ? `${minutes} minutes `: ""}${remainderSeconds} seconds`)
})