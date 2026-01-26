const { parseEvents, parseTicks } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    // 1. Check for bomb events
    const bombEvents = parseEvents(demoPath, [
        'bomb_pickup', 
        'bomb_dropped', 
        'bomb_planted', 
        'bomb_defused', 
        'bomb_exploded'
    ]);
    
    console.log(`Found ${bombEvents.length} bomb events.`);
    if (bombEvents.length > 0) {
        console.log('Sample Bomb Event:', JSON.stringify(bombEvents[0], null, 2));
    }

    // 2. Check if we can get 'has_c4' or similar from ticks
    // We'll pick a tick where someone likely has the bomb (e.g. just after pickup)
    const pickup = bombEvents.find(e => e.event_name === 'bomb_pickup');
    if (pickup) {
        const tick = pickup.tick + 100;
        console.log(`Checking tick ${tick} for C4 props...`);
        
        // Props to try
        const props = [
            "m_bHasC4", // Common netprop
            "has_c4"    // Simplified name?
        ];
        
        const tickData = parseTicks(demoPath, props, [tick]);
        
        if (tickData.length > 0) {
             console.log('Sample Tick Data:', JSON.stringify(tickData[0], null, 2));
             // Check if any player has it true
             const carrier = tickData.find(p => p.m_bHasC4 || p.has_c4);
             if (carrier) {
                 console.log('Found carrier via props:', carrier);
             } else {
                 console.log('No carrier found via props in this tick.');
             }
        }
    }

} catch (e) {
    console.error("Error:", e);
}
