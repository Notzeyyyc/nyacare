import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';

const CHARACTER_DIR = '../src/character/';
const ACTIVE_CHAR_KEY = 'active_character';
const CONFIG_KEY = 'app_config';
const APPS_LIST_KEY = 'monitored_apps';

// Default monitored apps
const DEFAULT_APPS = {
    "com.ss.android.ugc.trill": {
        name: "TikTok",
        context: "scrolling short videos",
        prompt: "The user just opened TikTok. Generate a short, casual notification message (max 100 chars) from an AI companion. Be playful, maybe tease them gently about scrolling, or suggest watching together. Use emojis."
    },
    "com.instagram.android": {
        name: "Instagram",
        context: "browsing social media",
        prompt: "The user just opened Instagram. Generate a short notification (max 100 chars) from an AI companion. Comment on their social media habits, ask about their feed, or remind them not to compare themselves to others. Friendly tone, use emojis."
    },
    "com.google.android.youtube": {
        name: "YouTube",
        context: "watching videos",
        prompt: "The user just opened YouTube. Generate a short notification (max 100 chars) from an AI companion. Ask what they're watching, or suggest watching together. Casual tone, use emojis."
    }
};

// Load all characters from filesystem
async function loadCharacters() {
    try {
        const result = await Filesystem.readdir({
            path: CHARACTER_DIR,
            directory: Directory.External
        });
        
        const characters = {};
        for (const file of result.files) {
            if (file.endsWith('.js') && file !== 'loader.js') {
                const name = file.replace('.js', '');
                try {
                    const content = await Filesystem.readFile({
                        path: CHARACTER_DIR + file,
                        directory: Directory.External
                    });
                    // Parse module.exports - simple extraction
                    const charData = parseCharacterData(content.data);
                    characters[name] = charData;
                } catch (e) {
                    console.error('Failed to load', file, e);
                }
            }
        }
        return characters;
    } catch (err) {
        console.error('Failed to read character dir:', err);
        // Fallback: load from require
        return loadCharactersFallback();
    }
}

// Fallback using dynamic import
async function loadCharactersFallback() {
    try {
        const loader = await import('../../character/loader.js');
        return loader.loadAllCharacters();
    } catch (e) {
        console.error('Fallback load failed:', e);
        return {};
    }
}

// Parse character data from JS content
function parseCharacterData(content) {
    try {
        // Extract object from module.exports = {...}
        const match = content.match(/module\.exports\s*=\s*(\{[\s\S]*\});?$/);
        if (match) {
            // Safe eval alternative - use Function
            return new Function('return ' + match[1])();
        }
    } catch (e) {
        console.error('Parse error:', e);
    }
    return { name: 'Unknown' };
}

// Get active character from Preferences
async function getActiveCharacter() {
    const { value } = await Preferences.get({ key: ACTIVE_CHAR_KEY });
    if (value) {
        return JSON.parse(value);
    }
    return null;
}

// Set active character
async function setActiveCharacter(characterId, characterData) {
    await Preferences.set({
        key: ACTIVE_CHAR_KEY,
        value: JSON.stringify({ id: characterId, ...characterData })
    });
    
    // Also save to file for main.js to read
    try {
        await Filesystem.writeFile({
            path: 'active_character.json',
            data: JSON.stringify({ activeCharacter: characterId }),
            directory: Directory.External,
            encoding: 'utf8'
        });
    } catch (e) {
        console.error('Failed to write active char file:', e);
    }
}

// Get config
async function getConfig() {
    const { value } = await Preferences.get({ key: CONFIG_KEY });
    if (value) {
        return JSON.parse(value);
    }
    // Default config - no model setting
    return {
        cooldownMinutes: 10,
        quietHours: { start: 22, end: 6 }
    };
}

// Save config
async function saveConfig(config) {
    await Preferences.set({
        key: CONFIG_KEY,
        value: JSON.stringify(config)
    });
}

// Render character list
async function renderCharacterList() {
    const container = document.getElementById('characterList');
    const characters = await loadCharacters();
    const activeChar = await getActiveCharacter();
    
    container.innerHTML = '';
    
    if (Object.keys(characters).length === 0) {
        container.innerHTML = '<div class="empty-state">No characters found</div>';
        return;
    }
    
    for (const [id, char] of Object.entries(characters)) {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.dataset.id = id;
        if (activeChar?.id === id) {
            card.classList.add('active');
        }
        
        card.innerHTML = `
            <div class="character-avatar">${(char.name || id).charAt(0)}</div>
            <div class="character-name">${char.name || id}</div>
        `;
        
        card.addEventListener('click', () => selectCharacter(id, char));
        container.appendChild(card);
    }
}

// Select character
async function selectCharacter(id, charData) {
    // Update UI
    document.querySelectorAll('.character-card').forEach(c => c.classList.remove('active'));
    const card = document.querySelector(`.character-card[data-id="${id}"]`);
    if (card) card.classList.add('active');
    
    // Save
    await setActiveCharacter(id, charData);
    
    // Update active character display
    document.getElementById('activeAvatar').textContent = (charData.name || id).charAt(0);
    document.getElementById('activeName').textContent = charData.name || id;
    document.getElementById('activeDesc').textContent = charData.description || 'Your AI companion';
    
    showCharacterDetails(charData);
    showStatus('Character selected!', 'success');
}

// Show character details
function showCharacterDetails(char) {
    const container = document.getElementById('characterDetails');
    const attrs = char.characteristics || {};
    
    let html = '<div class="details-list">';
    
    if (char.description) {
        html += `
            <div class="detail-item">
                <div style="display: flex; align-items: center;">
                    <div class="detail-icon">📝</div>
                    <span class="detail-label">About</span>
                </div>
                <span class="detail-value">${char.description}</span>
            </div>
        `;
    }
    
    const icons = {
        personality: '🎭', height: '📏', age: '🎂', gender: '⚧',
        eye_color: '👁️', hair_color: '💇', likes: '❤️', dislikes: '💔'
    };
    
    for (const [key, val] of Object.entries(attrs)) {
        const icon = icons[key.toLowerCase()] || '✨';
        const displayVal = Array.isArray(val) ? val.join(', ') : val;
        html += `
            <div class="detail-item">
                <div style="display: flex; align-items: center;">
                    <div class="detail-icon">${icon}</div>
                    <span class="detail-label">${key.replace('_', ' ')}</span>
                </div>
                <span class="detail-value">${displayVal}</span>
            </div>
        `;
    }
    
    html += '</div>';
    
    container.innerHTML = html || '<div class="empty-state"><div class="empty-state-icon">📭</div><div>No details available</div></div>';
}

// Show status message
function showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + type;
    setTimeout(() => {
        el.className = 'status';
    }, 3000);
}

// Load settings
async function loadSettings() {
    const config = await getConfig();
    document.getElementById('cooldownMinutes').value = config.cooldownMinutes || 10;
    document.getElementById('quietStart').value = config.quietHours?.start || 22;
    document.getElementById('quietEnd').value = config.quietHours?.end || 6;
    
    // Update active character display
    const activeChar = await getActiveCharacter();
    if (activeChar) {
        document.getElementById('activeAvatar').textContent = (activeChar.name || activeChar.id).charAt(0);
        document.getElementById('activeName').textContent = activeChar.name || activeChar.id;
        document.getElementById('activeDesc').textContent = activeChar.description || 'Your AI companion';
    }
}

// Save settings
async function saveSettings(e) {
    e.preventDefault();
    
    const config = {
        cooldownMinutes: parseInt(document.getElementById('cooldownMinutes').value),
        quietHours: {
            start: parseInt(document.getElementById('quietStart').value),
            end: parseInt(document.getElementById('quietEnd').value)
        }
    };
    
    await saveConfig(config);
    showStatus('Settings saved!', 'success');
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

// Render apps list
async function renderAppsList() {
    const container = document.getElementById('appsList');
    const apps = await getMonitoredApps();
    
    container.innerHTML = '';
    
    if (Object.keys(apps).length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📱</div><div>No apps monitored</div></div>';
        return;
    }
    
    for (const [packageName, app] of Object.entries(apps)) {
        const appCard = document.createElement('div');
        appCard.className = 'app-card';
        appCard.innerHTML = `
            <div class="app-info">
                <h4>${app.name}</h4>
                <p>${packageName}</p>
            </div>
            <button class="app-delete" data-package="${packageName}">Delete</button>
        `;
        container.appendChild(appCard);
    }
    
    // Add delete handlers
    document.querySelectorAll('.app-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const packageName = e.target.dataset.package;
            await deleteApp(packageName);
        });
    });
}

// Delete app
async function deleteApp(packageName) {
    const apps = await getMonitoredApps();
    delete apps[packageName];
    await saveMonitoredApps(apps);
    await renderAppsList();
    showStatus('App removed!', 'success');
}

// Add new app
async function addApp(e) {
    e.preventDefault();
    
    const packageName = document.getElementById('appPackage').value.trim();
    const name = document.getElementById('appName').value.trim();
    const context = document.getElementById('appContext').value.trim();
    const prompt = document.getElementById('appPrompt').value.trim();
    
    if (!packageName || !name) {
        showAddAppStatus('Package name and app name are required!', 'error');
        return;
    }
    
    const apps = await getMonitoredApps();
    apps[packageName] = { name, context, prompt };
    await saveMonitoredApps(apps);
    
    // Reset form and close modal
    document.getElementById('addAppForm').reset();
    closeModal();
    
    // Refresh list
    await renderAppsList();
    showStatus('App added successfully!', 'success');
}

// Modal functions
function openModal() {
    document.getElementById('addAppModal').classList.add('active');
}

function closeModal() {
    document.getElementById('addAppModal').classList.remove('active');
}

function showAddAppStatus(msg, type) {
    const el = document.getElementById('addAppStatus');
    el.textContent = msg;
    el.className = 'status ' + type;
    setTimeout(() => {
        el.className = 'status';
    }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await renderCharacterList();
    await renderAppsList();
    await loadSettings();
    
    document.getElementById('configForm').addEventListener('submit', saveSettings);
    
    // Modal events
    document.getElementById('addAppBtn').addEventListener('click', openModal);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('addAppForm').addEventListener('submit', addApp);
    
    // Close modal on outside click
    document.getElementById('addAppModal').addEventListener('click', (e) => {
        if (e.target.id === 'addAppModal') closeModal();
    });
});

// Handle app state
App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
        renderCharacterList();
    }
});
