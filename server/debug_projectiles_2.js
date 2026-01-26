const { parseEvents, parseTicks } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    // 1. Check for grenade_thrown
    const thrown = parseEvents(demoPath, ['grenade_thrown']);
    
    if (thrown.length > 0) {
        console.log('Sample grenade_thrown:', JSON.stringify(thrown[0], null, 2));
    } else {
        console.log('No grenade_thrown events.');
    }

    // 2. Try CS2 specific projectile names?
    // In CS2, many entities are just "grenade_projectile" or similar.
    // Let's try to fetch a common property like "m_nModelIndex" or similar from a generic class if possible? 
    // No, we need the class name.
    
    // Let's try these names:
    const names = [
        "smokegrenade_projectile",
        "molotov_projectile", 
        "flashbang_projectile",
        "hegrenade_projectile",
        "decoy_projectile"
    ];

    // Let's try a wider search or different function?
    // parseTicks is correct. Maybe I just need to match the exact string.
    
} catch (e) {
    console.error("Error:", e);
}
