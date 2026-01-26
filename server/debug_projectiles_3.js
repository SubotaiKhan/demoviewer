const { parseTicks } = require('@laihoe/demoparser2');
const path = require('path');

const demoPath = path.join(__dirname, '..', 'demos', 'pjm1.dem');

try {
    const ticks = [4000, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010];
    
    // Variations to try
    const names = [
        "smokegrenade_projectile", // CSGO
        "molotov_projectile",
        "flashbang_projectile",
        "hegrenade_projectile",
        
        "smoke_grenade_projectile", // Maybe?
        "incendiary_grenade_projectile",

        // CS2 Classes (sometimes mapped differently)
        "C_SmokeGrenadeProjectile",
        "C_MolotovProjectile",
        
        // Generic?
        "grenade_projectile"
    ];

    console.log("Checking for:", names.join(", "));

    const data = parseTicks(demoPath, ["X", "Y", "Z"], ticks, names);
    
    if (data.length > 0) {
        console.log(`Found ${data.length} records.`);
        console.log("Classes found:", [...new Set(data.map(d => d.cls_name || d.class_name || "unknown"))]);
        console.log("Sample:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("No data found.");
    }

} catch (e) {
    console.error("Error:", e);
}
