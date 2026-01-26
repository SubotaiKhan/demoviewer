const { parseTicks } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    const tick = 15000;
    const props = [
        // Simple aliases often supported
        "health", 
        "armor", 
        "has_helmet", 
        "has_defuser",
        
        // CSGO Netprops
        "m_iHealth", 
        "m_ArmorValue", 
        "m_bHasHelmet",
        "m_bHasDefuser",

        // CS2 Netprops (often on Pawn)
        "m_iPawnHealth",
        "m_pPawn.m_iHealth",
        "m_bPawnHasHelmet"
    ];

    console.log("Fetching player props...");
    const data = parseTicks(demoPath, props, [tick]);

    if (data.length > 0) {
        // Filter out keys that are undefined to see what worked
        const sample = data[0];
        const found = {};
        for (const k in sample) {
            if (sample[k] !== undefined) found[k] = sample[k];
        }
        console.log("Sample Player Data (Filtered):", JSON.stringify(found, null, 2));
    }

} catch (e) {
    console.error("Error:", e);
}
