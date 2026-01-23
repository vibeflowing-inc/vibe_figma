import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import fs from 'fs/promises'
import prompt from "./prompt.txt"


export const cleanupGeneratedCodeToReadable = async (code: string): Promise<string> => {
    try {
        
        if(!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set")
        }
        const response = await generateText({
            model: google('gemini-3-flash-preview'),
            system: prompt,
            prompt: `Here is the code to clean:\n\n<vibe-code>\n${code}\n</vibe-code>`
        })

        const codeMatch = response.text.match(/<vibe-code>([\s\S]*?)<\/vibe-code>/);

        if (!codeMatch || !codeMatch[1]) {
            console.warn('AI response did not contain <vibe-code> tags, returning raw response');
            return code
        }

        return codeMatch[1].trim();
    } catch (e) {
        console.error('Error during code cleanup:', e);
        return code
    }
}