const { LocalNotifications } = require('@capacitor/local-notifications');
const { Filesystem, Directory } = require('@capacitor/filesystem');
const { Preferences } = require('@capacitor/preferences');
const characterLoader = require('../character/loader');

const CONFIG_KEY = 'app_config';
const ACTIVE_CHAR_KEY = 'active_character';
const LAST_NOTIF_KEY = 'last_notification_time';
const APPS_LIST_KEY = 'monitored_apps';
const LAST_APP_KEY = 'last_foreground_app';

// Default monitored apps with AI prompts
const DEFAULT_APPS = {
    "com.ss.android.ugc.trill": {
        name: "TikTok",
        context: "scrolling short videos",
        prompt: "The user just opened TikTok. Generate a short, casual notification message (max 100 chars) from an AI companion. Be playful, maybe tease them gently about scrolling, or suggest watching together. Use emojis."
    },
    "com.zhiliaoapp.musically": {
        name: "TikTok (Global)",
        context: "scrolling short videos",
        prompt: "The user just opened TikTok. Generate a short, casual notification message (max 100 chars) from an AI companion. Be playful, maybe tease them gently about scrolling, or suggest watching together. Use emojis."
    },
    "com.instagram.android": {
        name: "Instagram",
        context: "browsing social media",
        prompt: "The user just opened Instagram. Generate a short notification (max 100 chars) from an AI companion. Comment on their social media habits, ask about their feed, or remind them not to compare themselves to others. Friendly tone, use emojis."
    },
    "com.snapchat.android": {
        name: "Snapchat",
        context: "messaging friends",
        prompt: "The user just opened Snapchat. Generate a short notification (max 100 chars) from an AI companion. Ask who they're snapping, or joke about disappearing messages. Casual and fun, use emojis."
    },
    "com.discord": {
        name: "Discord",
        context: "gaming/chatting",
        prompt: "The user just opened Discord. Generate a short notification (max 100 chars) from an AI companion. Ask about their gaming session, or what server they're checking. Gamer-friendly tone, use emojis."
    },
    "com.android.chrome": {
        name: "Chrome",
        context: "browsing web",
        prompt: "The user just opened Chrome. Generate a short notification (max 100 chars) from an AI companion. Ask what they're looking up, or tease them about their search history. Playful tone, use emojis."
    },
    "com.google.android.youtube": {
        name: "YouTube",
        context: "watching videos",
        prompt: "The user just opened YouTube. Generate a short notification (max 100 chars) from an AI companion. Ask what they're watching, or suggest watching together. Casual tone, use emojis."
    }
};

// Get config
async function getConfig() {
    const { value } = await Preferences.get({ key: CONFIG_KEY });
    if (value) return JSON.parse(value);
    return {
        cooldownMinutes: 10,
        quietHours: { start: 22, end: 6 },
        apiKey: '',
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-oss-120b:free'
    };
}

// Get active character
async function getActiveCharacter() {
    const { value } = await Preferences.get({ key: ACTIVE_CHAR_KEY });
    if (value) return JSON.parse(value);
    return characterLoader.getActiveCharacter();
}

// Get monitored apps
async function getMonitoredApps() {
    const { value } = await Preferences.get({ key: APPS_LIST_KEY });
    if (value) return JSON.parse(value);
    return DEFAULT_APPS;
}

// Save monitored apps
async function saveMonitoredApps(apps) {
    await Preferences.set({
        key: APPS_LIST_KEY,
        value: JSON.stringify(apps)
    });
}

// Add new app
async function addMonitoredApp(packageName, name, context, prompt) {
    const apps = await getMonitoredApps();
    apps[packageName] = { name, context, prompt };
    await saveMonitoredApps(apps);
}

// Remove app
async function removeMonitoredApp(packageName) {
    const apps = await getMonitoredApps();
    delete apps[packageName];
    await saveMonitoredApps(apps);
}

// Check quiet hours
function isQuietHours(config) {
    const now = new Date();
    const hour = now.getHours();
    const { start, end } = config.quietHours;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
}

// Check cooldown
async function isCooldownOver(config) {
    const { value } = await Preferences.get({ key: LAST_NOTIF_KEY });
    if (!value) return true;
    const lastTime = parseInt(value);
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    return (Date.now() - lastTime) >= cooldownMs;
}

// Generate AI message via OpenRouter
async function generateAIMessage(config, character, appInfo) {
    try {
        const prompt = appInfo.prompt || `The user just opened ${appInfo.name}. Generate a short, friendly notification (max 100 chars).`;
        
        const response = await fetch(`${config.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://nyacare.app',
                'X-Title': 'NyaCare'
            },
            body: JSON.stringify({
                model: config.model || 'openai/gpt-oss-120b:free',
                messages: [
                    {
                        role: 'system',
                        content: `You are ${character.name}. ${character.description || 'An AI companion'}. Characteristics: ${JSON.stringify(character.characteristics || {})}. Respond as this character - short, casual, engaging. Max 100 chars. Use emojis.`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 100,
                temperature: 0.8
            })
        });
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        const message = data.choices?.[0]?.message?.content?.trim();
        
        if (message) return message.replace(/^["']|["']$/g, '');
        throw new Error('No message generated');
    } catch (err) {
        console.error('AI generation failed:', err);
        return getFallbackMessage(character, appInfo);
    }
}

// Fallback messages
function getFallbackMessage(character, appInfo) {
    const fallbacks = [
        `Hey! ${character.name} here! Opened ${appInfo.name}? 💕`,
        `Saw you open ${appInfo.name}! What are you up to? 👀`,
        `${appInfo.name} again? You really like that app! 😊`,
        `Whatcha doing on ${appInfo.name}? Tell me~ 💭`,
        `Don't forget about me while you're on ${appInfo.name}! 🥺`
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// Schedule notification
async function scheduleNotification(title, body, delaySeconds = 0) {
    try {
        await LocalNotifications.schedule({
            notifications: [{
                id: Date.now(),
                title,
                body,
                schedule: delaySeconds > 0 ? { at: new Date(Date.now() + delaySeconds * 1000) } : { at: new Date() },
                sound: 'default',
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                channelId: 'nyacare-channel'
            }]
        });
        
        await Preferences.set({ key: LAST_NOTIF_KEY, value: Date.now().toString() });
        console.log(`Notification: ${title} - ${body}`);
    } catch (err) {
        console.error('Failed to schedule notification:', err);
    }
}

// Handle app opened - main flow
async function handleAppOpened(packageName, appInfo) {
    const config = await getConfig();
    
    if (isQuietHours(config)) {
        console.log('Quiet hours, skipping');
        return;
    }
    
    if (!(await isCooldownOver(config))) {
        console.log('Cooldown active, skipping');
        return;
    }
    
    const character = await getActiveCharacter();
    if (!character) {
        console.log('No active character');
        return;
    }
    
    // Generate AI message
    const message = await generateAIMessage(config, character, appInfo);
    
    // Send notification
    await scheduleNotification(character.name, message);
}

// Check foreground app via trigger file
async function checkForegroundApp() {
    try {
        const triggerPath = '/data/local/tmp/nyacare_app.txt';
        
        try {
            await Filesystem.stat({ path: triggerPath, directory: Directory.External });
        } catch {
            return null;
        }
        
        const result = await Filesystem.readFile({
            path: triggerPath,
            directory: Directory.External,
            encoding: 'utf8'
        });
        
        const packageName = result.data?.trim();
        if (!packageName) return null;
        
        await Filesystem.deleteFile({ path: triggerPath, directory: Directory.External });
        
        const apps = await getMonitoredApps();
        const appInfo = apps[packageName];
        if (!appInfo) return null;
        
        // Check if different from last app
        const { value: lastApp } = await Preferences.get({ key: LAST_APP_KEY });
        if (lastApp === packageName) return null;
        
        await Preferences.set({ key: LAST_APP_KEY, value: packageName });
        
        return { packageName, appInfo };
    } catch (err) {
        console.error('Error checking app:', err);
        return null;
    }
}

// Start monitoring
function startMonitoring(intervalMs = 3000) {
    console.log('Starting Nyacare app monitoring...');
    
    LocalNotifications.requestPermissions().then(result => {
        console.log('Notification permissions:', result.display);
    });
    
    setInterval(async () => {
        const appChange = await checkForegroundApp();
        if (appChange) {
            console.log(`App opened: ${appChange.packageName}`);
            await handleAppOpened(appChange.packageName, appChange.appInfo);
        }
    }, intervalMs);
    
    checkForegroundApp();
}

// Test notification
async function testNotification() {
    const config = await getConfig();
    const character = await getActiveCharacter();
    
    if (!character) {
        console.log('No active character');
        return;
    }
    
    const testApp = {
        name: "Test App",
        prompt: "This is a test. Generate a short welcome message saying the system is working."
    };
    
    const message = await generateAIMessage(config, character, testApp);
    await scheduleNotification(character.name, message);
}

// Manual trigger
async function manualTrigger(packageName) {
    const apps = await getMonitoredApps();
    const appInfo = apps[packageName];
    
    if (appInfo) {
        await handleAppOpened(packageName, appInfo);
    } else {
        console.log(`App ${packageName} not monitored`);
    }
}

module.exports = {
    startMonitoring,
    handleAppOpened,
    testNotification,
    manualTrigger,
    scheduleNotification,
    getActiveCharacter,
    getConfig,
    getMonitoredApps,
    saveMonitoredApps,
    addMonitoredApp,
    removeMonitoredApp,
    generateAIMessage
};

// Auto-start
if (require.main === module) {
    startMonitoring();
}
