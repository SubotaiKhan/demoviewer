const { parseTicks, parseEvents } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    // Check for view angles
    const ticks = parseTicks(demoPath, ["X", "Y", "Z", "pitch", "yaw"], [2000]);
    console.log('Sample Tick Data:', ticks[0]);

    // Check for weapon_fire events
    const fireEvents = parseEvents(demoPath, ['weapon_fire']);
    if (fireEvents.length > 0) {
        console.log('Sample weapon_fire event:', JSON.stringify(fireEvents[0], null, 2));
    } else {
        console.log('No weapon_fire events found.');
    }

} catch (e) {
    console.error("Error:", e);
}
