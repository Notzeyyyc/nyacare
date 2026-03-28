const fs = require('fs');
const path = require('path');

const CHARACTER_DIR = path.join(__dirname);
const ACTIVE_CHAR_FILE = path.join(__dirname, '..', '..', 'active_character.json');

/**
 * Load all characters from the character directory
 * @returns {Object} Object with character names as keys and character data as values
 */
function loadAllCharacters() {
  const characters = {};
  
  try {
    const files = fs.readdirSync(CHARACTER_DIR);
    
    for (const file of files) {
      if (file.endsWith('.js') && file !== 'loader.js') {
        const characterName = path.basename(file, '.js');
        const characterPath = path.join(CHARACTER_DIR, file);
        
        try {
          // Clear require cache to allow hot reloading
          delete require.cache[require.resolve(characterPath)];
          const character = require(characterPath);
          characters[characterName] = character;
        } catch (err) {
          console.error(`Failed to load character ${characterName}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Failed to read character directory:', err.message);
  }
  
  return characters;
}

/**
 * Load a specific character by name
 * @param {string} name - Character name (filename without .js extension)
 * @returns {Object|null} Character object or null if not found
 */
function loadCharacter(name) {
  const characterPath = path.join(CHARACTER_DIR, `${name}.js`);
  
  if (!fs.existsSync(characterPath)) {
    return null;
  }
  
  try {
    delete require.cache[require.resolve(characterPath)];
    return require(characterPath);
  } catch (err) {
    console.error(`Failed to load character ${name}:`, err.message);
    return null;
  }
}

/**
 * Get list of all available character names
 * @returns {string[]} Array of character names
 */
function getCharacterList() {
  try {
    return fs.readdirSync(CHARACTER_DIR)
      .filter(file => file.endsWith('.js') && file !== 'loader.js')
      .map(file => path.basename(file, '.js'));
  } catch (err) {
    console.error('Failed to get character list:', err.message);
    return [];
  }
}

/**
 * Check if a character exists
 * @param {string} name - Character name
 * @returns {boolean}
 */
function characterExists(name) {
  const characterPath = path.join(CHARACTER_DIR, `${name}.js`);
  return fs.existsSync(characterPath);
}

/**
 * Get the currently active character (selected from dashboard)
 * @returns {Object|null} Active character object or null if not set
 */
function getActiveCharacter() {
  try {
    if (!fs.existsSync(ACTIVE_CHAR_FILE)) {
      // Return default/first available character
      const list = getCharacterList();
      if (list.length > 0) {
        return loadCharacter(list[0]);
      }
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(ACTIVE_CHAR_FILE, 'utf8'));
    if (data.activeCharacter && characterExists(data.activeCharacter)) {
      return loadCharacter(data.activeCharacter);
    }
    return null;
  } catch (err) {
    console.error('Failed to get active character:', err.message);
    return null;
  }
}

/**
 * Set the active character (called from dashboard)
 * @param {string} name - Character name to set as active
 * @returns {boolean} Success or failure
 */
function setActiveCharacter(name) {
  try {
    if (!characterExists(name)) {
      console.error(`Character ${name} does not exist`);
      return false;
    }
    
    fs.writeFileSync(ACTIVE_CHAR_FILE, JSON.stringify({
      activeCharacter: name,
      updatedAt: new Date().toISOString()
    }, null, 2));
    
    return true;
  } catch (err) {
    console.error('Failed to set active character:', err.message);
    return false;
  }
}

module.exports = {
  loadAllCharacters,
  loadCharacter,
  getCharacterList,
  characterExists,
  getActiveCharacter,
  setActiveCharacter
};
