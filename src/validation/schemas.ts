import { z } from "zod";




export const createPasswordSchema = z.object({
    password: z.string().min(8, "The password must be at least 8 character length")
    .max(25, "Text is too long"),
    personalInfo: z.object({
        name: z.string().min(1, "Name cannot be empty"),
        surname: z.string().min(1, "Surname cannot be empty"),
        birthDate: z.string().min(1, "Birth date cannot be empty")
    }),
    language: z.enum(["en", "tr", "fr"]).optional().default("en")
})

