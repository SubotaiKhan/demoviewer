const { parseEvents } = require('@laihoe/demoparser2');
const path = require('path');

// Adjusted path: go up one level from 'server' to root, then into 'demos'
const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    const events = parseEvents(demoPath, ['player_death']);

    if (events.length > 0) {
        console.log('Sample player_death event:', JSON.stringify(events[0], null, 2));
    } else {
        console.log('No player_death events found.');
    }
} catch (e) {
    console.error("Error parsing:", e);
}