const { parseEvents } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    const eventNames = [
        'flashbang_detonate',
        'hegrenade_detonate',
        'smokegrenade_detonate',
        'molotov_detonate',
        'inferno_startburn', // Molotovs usually trigger this or similar
        'inferno_expire'
    ];
    
    const events = parseEvents(demoPath, eventNames);
    
    const grouped = events.reduce((acc, e) => {
        if (!acc[e.event_name]) acc[e.event_name] = [];
        acc[e.event_name].push(e);
        return acc;
    }, {});

    Object.keys(grouped).forEach(key => {
        console.log(`Event: ${key}, Count: ${grouped[key].length}`);
        console.log(`Sample ${key}:`, JSON.stringify(grouped[key][0], null, 2));
    });

} catch (e) {
    console.error("Error:", e);
}
