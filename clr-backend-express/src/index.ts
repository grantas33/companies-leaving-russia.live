import dotenv from 'dotenv'
import express, {NextFunction, Request, Response} from 'express';
import axios, {AxiosResponse} from "axios";
import {HTMLElement, Node, NodeType, parse} from "node-html-parser";
import NodeCache from "node-cache";
import {GoogleSpreadsheet, GoogleSpreadsheetWorksheet} from 'google-spreadsheet';
import compression from 'compression'
import {Company, CompanyDynamicData, CompanyWithDynamicData, MainPage} from "../../models";
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc)
dotenv.config()
const app = express()
app.use(compression())
app.use(express.static('build'))

const myCache = new NodeCache();
const http = axios.create()

let sheet: GoogleSpreadsheetWorksheet
const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!!,
    private_key: process.env.GOOGLE_PRIVATE_KEY!!,
}).then(_ =>
    doc.loadInfo()
).then(_ => {
    sheet = doc.sheetsByIndex[0]
    console.log("Google spreadsheet has been loaded.")
});

let lastUpdatedAt: string

function withCache<T>(cacheName: string, ttl: number, data: () => T): T {
    let result: T|undefined = myCache.get(cacheName)
    if (!result) {
        result = data()
        myCache.set(cacheName, result, ttl)
    }
    return result!!
}

async function getStoredCompanyDynamicData(): Promise<Record<string, CompanyDynamicData>> {
    const sheetRows = await sheet.getRows();
    return Object.fromEntries(
        sheetRows.map(row => [row.company, {logoUrl: row.logourl, summary: row.summary}])
    )
}

async function getDynamicData(companyTitle: string): Promise<CompanyDynamicData> {
    const [logoUrl, summary] = await Promise.all([fetchLogoUrl(companyTitle), fetchSummary(companyTitle)])
    return {logoUrl: logoUrl, summary: summary}
}

async function updateStorage(newCompanies: Record<string, CompanyDynamicData>) {
    if (Object.keys(newCompanies).length > 0) {
        const newRows = Object.entries(newCompanies).map(([title, data]) => [title, data.logoUrl || "", data.summary || ""])
        await sheet.addRows(newRows)
    }
}

async function fetchLogoUrl(companyTitle: string): Promise<string | undefined> {
    try {
        const response = await http.get(`https://worldvectorlogo.com/search/${encodeURIComponent(companyTitle)}`)
        return parse(response.data)?.querySelector(".logos .logo .logo__img")?.attrs?.src
    } catch (e) {
        return undefined
    }
}

async function fetchSummary(companyTitle: string): Promise<string | undefined> {
    try {
        const response = await http.get(`https://en.wikipedia.org/w/api.php?action=query&prop=pageterms&redirects&titles=${encodeURIComponent(companyTitle)}&format=json`)
        return response.data?.query?.pages && (Object.values(response.data.query.pages)?.[0] as any)?.terms?.description?.[0]
    } catch (e) {
        return undefined
    }
}

function extractReadableText(node: Node): string {
    return node.childNodes.map(it => {
        if (it.nodeType == NodeType.TEXT_NODE) return it.text
        if (it.nodeType == NodeType.ELEMENT_NODE) {
            let el = it as HTMLElement
            if (!["sup"].includes(el.rawTagName)) return extractReadableText(el)
        }
        return ""
    }).join("").trim()
}

function extractSources(description: Node): number[] {
    return description.childNodes
        .filter(it => it.nodeType == NodeType.ELEMENT_NODE)
        .flatMap(it => {
            const el = it as HTMLElement
            if (el.rawTagName == "sup") return [Number(el.text.slice(1, -1)) - 1]
            return extractSources(el)
        })
}

function parseWikiResponse(response: string): Company[]|undefined {
    const root = parse(response);
    const companyTable = root.querySelector("table.wikitable.sortable")
        ?.querySelector("tbody")
        ?.querySelectorAll("tr")
        .splice(1)
    const references = root.querySelector("ol.references")
        ?.childNodes
        .filter(it => it.nodeType == NodeType.ELEMENT_NODE)
        .map(it => (it as HTMLElement).querySelector("cite.citation")?.innerHTML)
    return companyTable?.map(company => {
        let fields = company.querySelectorAll("td")
        return {
            title: fields[0].childNodes[0].text.trim(),
            industry: fields[1].childNodes[0].text.trim(),
            country: fields[2].childNodes[0].text.trim(),
            description: extractReadableText(fields[3]),
            sourceHtml: extractSources(fields[3]).map(it => references?.[it] || "")
        }
    })
}

async function getCompanies(): Promise<Company[] | undefined> {
    const response: AxiosResponse = await http.get("https://en.wikipedia.org/wiki/Corporate_responses_to_the_2022_Russian_invasion_of_Ukraine")
    lastUpdatedAt = dayjs.utc().format()
    return parseWikiResponse(response.data)
}

async function getCompaniesWithDynamicData(): Promise<CompanyWithDynamicData[]> {
    const companies = await withCache("companies", 3600, getCompanies)
    if (!companies) return []
    const storedDynamicData = await getStoredCompanyDynamicData()
    const newDynamicData: Record<string, CompanyDynamicData> = Object.fromEntries(
        await Promise.all(companies.filter(c => !storedDynamicData[c.title]).map(async c => [c.title, await getDynamicData(c.title)]))
    )
    await updateStorage(newDynamicData)
    return companies.map(it => ({...it, ...({...storedDynamicData, ...newDynamicData})[it.title]}))
}

app.use((req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000")
    next()
})

app.get('/main', async (req: Request, res: Response<MainPage>) => {
    const companies = await withCache("companies-with-dynamic-data", 60, getCompaniesWithDynamicData)
    res.send({lastUpdatedAt: lastUpdatedAt, companies: companies})
})

app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`)
})
