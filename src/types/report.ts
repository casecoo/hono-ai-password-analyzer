import { includes } from "zod"

export interface TextStats {
    upper: number
    lower: number
    digits: number
    special: number
    whitespace: number
    totalLength: number
    includesNameOrSurname: boolean
    hasBirthYear: boolean

}

export interface AiReport {
    report: string[]
    source: 'gemini' | 'local'
}
