const { parseTicks } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    const tick = 15000; // Mid-round
    const props = [
        "m_iHealth", 
        "m_ArmorValue", 
        "m_bHasHelmet", 
        "m_bHasDefuser", 
        "m_szLastPlaceName" // Location callout
    ];

    console.log("Fetching player props...");
    const data = parseTicks(demoPath, props, [tick]);

    if (data.length > 0) {
        console.log("Sample Player Data:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("No data found.");
    }
    
    // Check for weapons if possible? 
    // Usually hard with simple parseTicks unless there's a specific "weapons" field.
    // Some parsers expose "inventory" json.
    
} catch (e) {
    console.error("Error:", e);
}
