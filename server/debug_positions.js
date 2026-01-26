const { parseTicks } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

const startTick = 12774;
const endTick = 15533;
const interval = 32;

const ticksToParse = [];
for (let t = startTick; t <= endTick; t += interval) {
    ticksToParse.push(t);
}
// Always include the last tick if not already included
if (ticksToParse[ticksToParse.length - 1] !== endTick) {
    ticksToParse.push(endTick);
}

console.log(`Parsing ${ticksToParse.length} ticks:`, ticksToParse);

try {
    const positions = parseTicks(demoPath, ["X", "Y", "Z"], ticksToParse);
    console.log("Success! Got positions:", positions.length);
    if (positions.length > 0) {
        console.log("Sample:", positions[0]);
    }
} catch (error) {
    console.error("FAILED to parse ticks:");
    console.error(error);
}
