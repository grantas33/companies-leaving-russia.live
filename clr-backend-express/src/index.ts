import dotenv from 'dotenv'
import express, {NextFunction, Request, Response} from 'express';
import axios, {AxiosResponse} from "axios";
import {parse} from "node-html-parser";
import NodeCache from "node-cache";
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet} from 'google-spreadsheet';
import compression from 'compression'
import {Company, CompanyWithLogo} from "../../models";

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

function withCache<T>(cacheName: string, ttl: number, data: () => T): T {
    let result: T|undefined = myCache.get(cacheName)
    if (!result) {
        result = data()
        myCache.set(cacheName, result, ttl)
    }
    return result!!
}

async function getCompanyLogos(): Promise<Record<string, string>> {
    const sheetRows = await sheet.getRows();
    const logos: Record<string, string> = {}
    sheetRows.forEach(row => {
        logos[row.company] = row.logourl
    })
    return logos
}

async function getLogoUrl(companyTitle: string, logos: Record<string, string>): Promise<string|undefined> {
    try {
        if (!logos[companyTitle]) {
            const response = await http.get(`https://worldvectorlogo.com/search/${encodeURIComponent(companyTitle)}`)
            const logoUrl = parse(response.data)?.querySelector(".logos .logo .logo__img")?.attrs?.src
            await sheet.addRow([companyTitle, logoUrl || ""])
            return logoUrl
        } else {
            return logos[companyTitle]
        }
    } catch (e) {
        return undefined
    }
}

function parseWikiResponse(response: string): Company[]|undefined {
    const root = parse(response);
    const companyTable = root.querySelector("table.wikitable.sortable")
        ?.querySelector("tbody")
        ?.querySelectorAll("tr")
        .splice(1)
    return companyTable?.map(company => {
        let fields = company.querySelectorAll("td")
        return {
            title: fields[0].childNodes[0].text.trim(),
            industry: fields[1].childNodes[0].text.trim(),
            country: fields[2].childNodes[0].text.trim(),
            description: fields[3].childNodes[0].text.trim()
        }
    })
}

async function getCompanies(): Promise<Company[] | undefined> {
    const response: AxiosResponse = await http.get("https://en.wikipedia.org/wiki/Corporate_responses_to_the_2022_Russian_invasion_of_Ukraine")
    return parseWikiResponse(response.data)
}

async function getCompaniesWithLogos(): Promise<CompanyWithLogo[]> {
    const companies = await withCache("companies", 3600, getCompanies)
    if (!companies) return []
    const logos = await getCompanyLogos()
    return await Promise.all(companies.map(async c => ({...c, logoUrl: await getLogoUrl(c.title, logos)})))
}

app.use((req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000")
    next()
})

app.get('/list', async (req: Request, res: Response) => {
    const response = await withCache("companies-with-logos", 60, getCompaniesWithLogos)
    res.send(response)
})

app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`)
})
