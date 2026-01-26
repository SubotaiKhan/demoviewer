const { parseTicks, parseEvents } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    // 1. Check for grenade throw events to know when to look
    const throwEvents = parseEvents(demoPath, ['weapon_fire']);
    const smokeThrow = throwEvents.find(e => e.weapon === 'weapon_smokegrenade');
    
    if (smokeThrow) {
        console.log('Sample Smoke Throw:', JSON.stringify(smokeThrow, null, 2));
        
        // 2. Look for projectile entities around that tick
        // Common projectile names in CS2/GO
        const projectileNames = [
            'smokegrenade_projectile', 
            'hegrenade_projectile', 
            'flashbang_projectile',
            'molotov_projectile',
            'incendiarygrenade_projectile'
        ];

        const startTick = smokeThrow.tick;
        const endTick = startTick + 500; // Look ahead a bit

        const ticks = [];
        for (let t = startTick; t < endTick; t += 32) ticks.push(t);

        console.log(`Scanning ticks ${startTick} to ${endTick} for projectiles...`);

        // Fetch standard fields + maybe owner fields
        // 'owner' or 'thrower' might be an entity handle (integer), not steamid directly.
        // We might need to infer from position or `m_hOwnerEntity`.
        const projectileData = parseTicks(demoPath, [
            "X", "Y", "Z", 
            "m_hOwnerEntity", // Handle to owner
            "m_hThrower",     // Handle to thrower (often same)
        ], ticks, projectileNames);

        if (projectileData.length > 0) {
            console.log(`Found ${projectileData.length} projectile data points.`);
            console.log('Sample Projectile Data:', JSON.stringify(projectileData[0], null, 2));
        } else {
            console.log('No projectile data found with those names.');
        }

    } else {
        console.log('No smoke throws found in demo.');
    }

} catch (e) {
    console.error("Error:", e);
}
