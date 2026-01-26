const { parseEvents } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    const events = parseEvents(demoPath, ['bomb_planted', 'bomb_exploded', 'bomb_defused']);
    if (events.length > 0) {
        console.log('Sample bomb_planted:', JSON.stringify(events[0], null, 2));
    }
} catch (e) {
    console.error("Error:", e);
}
