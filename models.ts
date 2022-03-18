export type Company = {
    title: string,
    industry: string,
    country: string,
    description: string,
    sourceHtml: string[]
}

export type CompanyDynamicData = {
    logoUrl?: string,
    summary?: string
}

export type CompanyWithDynamicData = Company & CompanyDynamicData

export type MainPage = {
    lastUpdatedAt: string,
    companies: CompanyWithDynamicData[]
}

