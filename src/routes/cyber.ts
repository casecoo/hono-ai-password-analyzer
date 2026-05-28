import { Hono } from 'hono'
import { createPasswordSchema } from '../validation/schemas'
import { zValidator } from '@hono/zod-validator'
import { AIService } from '../services/ai-service'
import { AppContext } from '../types/env'


export const cyberRoutes = new Hono<AppContext>()
.post(
    '/',
    zValidator('json', createPasswordSchema),
    async (c) => {

        try {

            const body = c.req.valid('json')

            const inputText: string = body.password
            const personalInfo = body.personalInfo
            const language = body.language

            if (!inputText) 
                return c.json({error: 'Please send the text area.'}, 400)

            const aiService = new AIService(c)

            const aiReport = await aiService.callGenAi(inputText, personalInfo, language)

             return c.json({
                status: 'success',
                hybridScore: aiReport.hybridScore,
                processedResult: aiReport.report
            }, 200);

        }

        catch (error) {
             return c.json({ error: 'Unvalid json format or server error.' }, 500);
        }
    }
)

