export type Company = {
    title: string,
    industry: string,
    country: string,
    description: string
}

export type CompanyWithLogo = {
    logoUrl?: string
} & Company
