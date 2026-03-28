import { getActiveCharacter } from '../character/loader.js';

export const config = {
    apiKey: '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',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-oss-120b:free',
    cooldownMinutes: 10,
    quietHours: {
        start: 22,
        end: 6
    },
    triggerFilePath: '/data/local/tmp/nyacare.txt',

    apps: {
        "com.ss.android.ugc.trill": {
            name: "tiktok",
            context: "scrolling short videos",
            get characterAi() {
                return getActiveCharacter();
            }
        }
    }
}