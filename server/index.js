const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parseHeader, parseEvents, parseTicks } = require('@laihoe/demoparser2');

const app = express();
const PORT = process.env.PORT || 3001;
const DEMOS_DIR = path.join(__dirname, '..', 'demos');
const MAPS_DIR = path.join(__dirname, '..', 'maps');

// Only enable CORS in development
if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
}
app.use(express.json());
app.use('/maps', express.static(MAPS_DIR));

// Multer setup for demo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(DEMOS_DIR)) {
            fs.mkdirSync(DEMOS_DIR, { recursive: true });
        }
        cb(null, DEMOS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.dem') {
            return cb(new Error('Only .dem files are allowed'));
        }
        cb(null, true);
    }
});

// Admin auth middleware
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function requireAdmin(req, res, next) {
    if (!ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Admin access is not configured on this server' });
    }
    const provided = req.headers['x-admin-password'];
    if (provided !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
    }
    next();
}

// Helper to check if file exists
const getDemoPath = (filename) => path.join(DEMOS_DIR, filename);

// Helper to parse KeyValues (simplified)
function parseKeyValues(text) {
    const result = {};
    const lines = text.split('\n');
    
    // Simple regex for "key" "value"
    const kvRegex = /"([^"]+)"\s+"([^"]+)"/;
    
    lines.forEach(line => {
        // Remove comments
        const cleanLine = line.split('//')[0].trim();
        const match = cleanLine.match(kvRegex);
        if (match) {
            result[match[1]] = match[2];
        }
    });
    return result;
}

// Get map metadata
app.get('/api/maps/:mapName', (req, res) => {
    const { mapName } = req.params;
    const mapDir = path.join(MAPS_DIR, mapName);

    if (!fs.existsSync(mapDir)) {
        return res.status(404).json({ error: 'Map not found' });
    }

    try {
        // Find metadata file
        const metaPath = path.join(mapDir, 'metadata.txt');
        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: 'Metadata not found' });
        }

        // Parse metadata
        const metaContent = fs.readFileSync(metaPath, 'utf8');
        const kv = parseKeyValues(metaContent);

        // Find image file
        const files = fs.readdirSync(mapDir);
        const imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));

        if (!imageFile) {
            return res.status(404).json({ error: 'Map image not found' });
        }

        res.json({
            pos_x: parseFloat(kv.pos_x),
            pos_y: parseFloat(kv.pos_y),
            scale: parseFloat(kv.scale),
            imageUrl: `/maps/${mapName}/${imageFile}`
        });
    } catch (error) {
        console.error('Error getting map data:', error);
        res.status(500).json({ error: 'Failed to get map data' });
    }
});

// Get team clan names from tick data (the actual organization names)
function getTeamClanNames(filePath) {
    try {
        // Parse tick data at an early tick to get team_clan_name for each player
        // We need a tick after players have joined but before halftime swap
        const tickData = parseTicks(filePath, [
            "team_clan_name",
            "team_num"
        ], [5000, 10000, 15000]); // Try a few early ticks

        if (!tickData || tickData.length === 0) return null;

        // Find the CT and T team clan names
        let ctTeamName = null;
        let tTeamName = null;

        for (const player of tickData) {
            if (player.team_clan_name && player.team_num) {
                if (player.team_num === 3 && !ctTeamName) {
                    ctTeamName = player.team_clan_name;
                } else if (player.team_num === 2 && !tTeamName) {
                    tTeamName = player.team_clan_name;
                }
            }
            // Stop once we have both
            if (ctTeamName && tTeamName) break;
        }

        if (ctTeamName && tTeamName) {
            return { ctTeam: ctTeamName, tTeam: tTeamName };
        }

        return null;
    } catch (error) {
        console.error('Error getting team clan names:', error.message);
        return null;
    }
}

// Cache parsed demo summaries to avoid re-parsing on every list request.
const demoSummaryCache = new Map();

function getDemoSummary(filePath) {
    const fileStats = fs.statSync(filePath);
    const cached = demoSummaryCache.get(filePath);

    if (cached && cached.size === fileStats.size) {
        return cached.summary;
    }

    try {
        const header = parseHeader(filePath);
        const events = parseEvents(filePath, ['round_end', 'player_team', 'round_freeze_end']);
        const matchStats = calculateMatchStats(events);

        const players = matchStats.players.map(p => ({ name: p.name, startingTeam: p.startingTeam }));

        // Get team clan names directly from tick data
        const teams = getTeamClanNames(filePath);

        const summary = {
            map: header.map_name,
            duration: header.playback_time,
            score: matchStats.score,
            totalRounds: matchStats.totalRounds,
            players: players,
            teams: teams  // { ctTeam: "...", tTeam: "..." } or null
        };

        demoSummaryCache.set(filePath, { size: fileStats.size, summary });
        return summary;
    } catch (error) {
        console.error(`Error parsing demo summary for ${filePath}:`, error.message);
        return null;
    }
}

// List all demos
app.get('/api/demos', (req, res) => {
    try {
        if (!fs.existsSync(DEMOS_DIR)) {
            return res.status(404).json({ error: 'Demos directory not found' });
        }
        const files = fs.readdirSync(DEMOS_DIR).filter(file => file.endsWith('.dem'));

        const demoList = files.map(file => {
            const filePath = getDemoPath(file);
            const stats = fs.statSync(filePath);
            const summary = getDemoSummary(filePath);
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
                ...summary
            };
        });

        res.json(demoList);
    } catch (error) {
        console.error('Error listing demos:', error);
        res.status(500).json({ error: 'Failed to list demos' });
    }
});

// Determine if teams have swapped sides for a given round number.
// CS2: MR12 regulation (swap after round 12), MR3 overtime (swap every 3 rounds).
function areSidesSwapped(roundNumber) {
    if (roundNumber <= 12) return false;  // First half
    if (roundNumber <= 24) return true;   // Second half
    // Overtime: alternates every 3 rounds
    const otRound = roundNumber - 24;
    const otHalf = Math.ceil(otRound / 3);
    return otHalf % 2 === 0;
}

function calculateMatchStats(events) {
    const players = {};
    const teams = {
        2: { name: 'T', score: 0 },
        3: { name: 'CT', score: 0 }
    };
    let validRounds = 0;
    const rounds = []; // To store round history
    let lastRoundStartTick = 0;
    
    // Helper to create a default player object
    const createPlayer = (steamid, name) => ({
        steamid,
        name: name || 'Unknown',
        team: null,
        startingTeam: null, // The first team assigned (represents their organization)
        kills: 0,
        deaths: 0,
        assists: 0,
        headshots: 0,
        damage: 0,
        // Add new stats here easily
    });

    // Helper to ensure player exists in map
    const getPlayer = (steamid, name) => {
        if (!steamid) return null;
        if (!players[steamid]) {
            players[steamid] = createPlayer(steamid, name);
        }
        // Update name if we have a better one (or just latest)
        if (name) players[steamid].name = name;
        return players[steamid];
    };

    events.sort((a, b) => a.tick - b.tick);

    events.forEach(e => {
        if (e.event_name === 'player_team') {
            if (e.user_steamid) {
                const p = getPlayer(e.user_steamid, e.user_name);
                // Only track T/CT teams (2/3)
                if (e.team === 2 || e.team === 3) {
                    // Track starting team (first assignment = their organization)
                    if (p.startingTeam === null) {
                        p.startingTeam = e.team;
                    }
                    p.team = e.team;
                }
            }
        }
        else if (e.event_name === 'round_freeze_end') {
            lastRoundStartTick = e.tick;
        }
        else if (e.event_name === 'round_end') {
            // Count round if it has a valid winner
            let winnerTeam = null;
            // Normalize winner to number
            if (e.winner === 'T' || e.winner == 2) winnerTeam = 2;
            else if (e.winner === 'CT' || e.winner == 3) winnerTeam = 3;

            if (winnerTeam) {
                validRounds++;
                // winnerTeam is the side that won (2=T, 3=CT). After side switches,
                // the team occupying that side is the one that originally started on
                // the opposite side, so we credit the score to the original team.
                const swapped = areSidesSwapped(validRounds);
                const scoreTeam = swapped ? (winnerTeam === 2 ? 3 : 2) : winnerTeam;
                teams[scoreTeam].score++;
                
                rounds.push({
                    round: validRounds, // Sequential round number
                    winner: winnerTeam,
                    reason: e.reason,
                    tick: e.tick,
                    startTick: lastRoundStartTick,
                    endTick: e.tick
                });
            }
        }
        else if (e.event_name === 'player_death') {
            const killer = getPlayer(e.attacker_steamid, e.attacker_name);
            const victim = getPlayer(e.user_steamid, e.user_name);
            const assister = getPlayer(e.assister_steamid, e.assister_name);

            if (victim) {
                victim.deaths++;
            }

            if (killer && killer !== victim) {
                killer.kills++;
                if (e.headshot) killer.headshots++;
            }

            if (assister) {
                assister.assists++;
            }
        }
        else if (e.event_name === 'player_hurt') {
            const attacker = getPlayer(e.attacker_steamid, e.attacker_name);
            const victim = getPlayer(e.user_steamid, e.user_name);

            if (attacker && victim && attacker.steamid !== victim.steamid) {
                const sameTeam = attacker.team && victim.team && attacker.team === victim.team;
                if (!sameTeam) {
                    attacker.damage += e.dmg_health;
                }
            }
        }
    });

    // Calculate derived stats (ADR)
    const playerList = Object.values(players).filter(p => p.startingTeam === 2 || p.startingTeam === 3);
    playerList.forEach(p => {
        p.adr = validRounds > 0 ? (p.damage / validRounds).toFixed(1) : 0;
    });

    return {
        score: {
            t: teams[2].score,
            ct: teams[3].score
        },
        totalRounds: validRounds,
        rounds: rounds,
        players: playerList
    };
}

// Get demo details (header + scoreboard data)
app.get('/api/demos/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = getDemoPath(filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Demo file not found' });
    }

    try {
        const header = parseHeader(filePath);
        const events = parseEvents(filePath, ['player_death', 'round_end', 'player_team', 'player_hurt', 'round_freeze_end']);
        const stats = calculateMatchStats(events);

        res.json({
            header,
            matchStats: stats
        });
    } catch (error) {
        console.error('Error parsing demo:', error);
        res.status(500).json({ error: 'Failed to parse demo', details: error.message });
    }
});

// Get player positions for a tick range
app.get('/api/demos/:filename/positions', (req, res) => {
    const { filename } = req.params;
    const { startTick, endTick, interval = 1 } = req.query;
    const filePath = getDemoPath(filename);

    console.log(`[Positions] Request for ${filename}, ticks ${startTick}-${endTick}, interval ${interval}`);

    if (!fs.existsSync(filePath)) {
        console.error(`[Positions] File not found: ${filePath}`);
        return res.status(404).json({ error: 'Demo file not found' });
    }

    try {
        const start = parseInt(startTick);
        const end = parseInt(endTick);
        const step = parseInt(interval) || 1;

        if (isNaN(start) || isNaN(end)) {
            console.error(`[Positions] Invalid ticks: start=${start}, end=${end}`);
            return res.status(400).json({ error: 'Invalid tick range' });
        }

        // Parse ticks
        const ticks = [];
        for (let i = start; i <= end; i += step) {
            ticks.push(i);
        }

        const positions = parseTicks(filePath, [
            "X", "Y", "Z",
            "yaw",
            "team_num",
            "health",
            "armor",
            "has_helmet",
            "has_defuser",
            "active_weapon_name",
            "inventory"
        ], ticks);
        console.log(`[Positions] Got ${positions ? positions.length : 'null'} position records`);

        // Parse death events for this range
        const deathEvents = parseEvents(filePath, ["player_death"]);
        const relevantDeaths = deathEvents.filter(d => d.tick >= start && d.tick <= end);

        // Parse fire events for this range
        const fireEvents = parseEvents(filePath, ["weapon_fire"]);
        const relevantShots = fireEvents.filter(d => d.tick >= start && d.tick <= end);

        // Parse player blind events (when players get flashed)
        const blindEvents = parseEvents(filePath, ["player_blind"]);
        const relevantBlinds = blindEvents.filter(d => d.tick >= start && d.tick <= end);

        // Parse grenade events
        const grenadeEventsRaw = parseEvents(filePath, [
            'smokegrenade_detonate', 
            'hegrenade_detonate', 
            'flashbang_detonate',
            'inferno_startburn',
            'grenade_thrown',
            'bomb_pickup',
            'bomb_dropped',
            'bomb_planted',
            'bomb_defused',
            'bomb_exploded'
        ]);

        const thrownEvents = grenadeEventsRaw.filter(e => e.event_name === 'grenade_thrown').sort((a, b) => a.tick - b.tick);
        const bombEventsRaw = grenadeEventsRaw.filter(e => e.event_name.startsWith('bomb_')).sort((a, b) => a.tick - b.tick);

        const bombEvents = bombEventsRaw.map(e => {
            const newEvent = { ...e };
            // Attach coordinates for planted/dropped
            if (e.event_name === 'bomb_planted' || e.event_name === 'bomb_dropped') {
                const pPos = positions.find(p => p.tick === e.tick && p.steamid === e.user_steamid);
                if (pPos) {
                    newEvent.x = pPos.X;
                    newEvent.y = pPos.Y;
                    newEvent.z = pPos.Z;
                }
            }
            return newEvent;
        });
        
        const relevantGrenades = grenadeEventsRaw
            .filter(g => g.tick >= start && g.tick <= end && !g.event_name.startsWith('bomb_') && g.event_name !== 'grenade_thrown')
            .map(g => {
                let type = 'unknown';
                let weaponMatch = '';

                if (g.event_name === 'smokegrenade_detonate') { type = 'smoke'; weaponMatch = 'smokegrenade'; }
                else if (g.event_name === 'hegrenade_detonate') { type = 'he'; weaponMatch = 'hegrenade'; }
                else if (g.event_name === 'flashbang_detonate') { type = 'flash'; weaponMatch = 'flashbang'; }
                else if (g.event_name === 'inferno_startburn') { type = 'fire'; weaponMatch = 'molotov'; } // check inc too?

                // Find matching throw event
                // Look for throws by this user, before this tick, matching weapon
                // We search backwards from the detonation tick
                const throwEvent = thrownEvents
                    .filter(t => 
                        t.tick < g.tick && 
                        t.user_steamid === g.user_steamid && 
                        (t.weapon.includes(weaponMatch) || (type === 'fire' && t.weapon.includes('incgrenade')))
                    )
                    .pop(); // Get the last one (closest to detonation)

                let throwPos = null;
                if (throwEvent) {
                    // Find player position at throw tick
                    // Note: 'positions' array covers the requested range. 
                    // If throw was before requested range, we might miss it. 
                    // But usually we request full round.
                    const pPos = positions.find(p => p.tick === throwEvent.tick && p.steamid === throwEvent.user_steamid);
                    if (pPos) {
                        throwPos = { x: pPos.X, y: pPos.Y, z: pPos.Z };
                    }
                }

                return {
                    type,
                    tick: g.tick,
                    x: g.x,
                    y: g.y,
                    z: g.z,
                    throwerSteamId: g.user_steamid,
                    throwerName: g.user_name,
                    throwTick: throwEvent ? throwEvent.tick : null,
                    throwPos: throwPos
                };
            });

        const kills = relevantDeaths.map(d => {
            // Find victim's position at the death tick
            const victimPos = positions.find(p => p.tick === d.tick && p.steamid === d.user_steamid);
            
            if (victimPos) {
                return {
                    tick: d.tick,
                    victimSteamId: d.user_steamid,
                    victimName: d.user_name,
                    attackerName: d.attacker_name,
                    weapon: d.weapon,
                    headshot: d.headshot,
                    x: victimPos.X,
                    y: victimPos.Y,
                    z: victimPos.Z
                };
            }
            return null;
        }).filter(k => k !== null);

        const shots = relevantShots.map(s => ({
            tick: s.tick,
            steamid: s.user_steamid,
            weapon: s.weapon
        }));
        
        // Group by tick for easier consumption
        const grouped = positions.reduce((acc, pos) => {
            if (!acc[pos.tick]) acc[pos.tick] = [];

            // Calculate remaining flash duration for this player at this tick
            // Look for blind events that affect this player and are still active
            let flashDuration = 0;
            for (const blind of relevantBlinds) {
                if (blind.user_steamid === pos.steamid) {
                    // blind_duration is in seconds, convert to ticks (64 ticks/sec)
                    const blindEndTick = blind.tick + (blind.blind_duration || 0) * 64;
                    if (pos.tick >= blind.tick && pos.tick < blindEndTick) {
                        // Calculate remaining duration in seconds
                        const remainingTicks = blindEndTick - pos.tick;
                        flashDuration = Math.max(flashDuration, remainingTicks / 64);
                    }
                }
            }

            acc[pos.tick].push({
                steamid: pos.steamid,
                name: pos.name,
                team: pos.team_num,
                yaw: pos.yaw ?? 0,
                x: pos.X,
                y: pos.Y,
                z: pos.Z,
                health: pos.health,
                armor: pos.armor,
                has_helmet: pos.has_helmet,
                has_defuser: pos.has_defuser,
                flash_duration: flashDuration > 0 ? flashDuration : undefined,
                active_weapon_name: pos.active_weapon_name,
                inventory: pos.inventory
            });
            return acc;
        }, {});

        res.json({
            positions: grouped,
            kills: kills,
            shots: shots,
            grenades: relevantGrenades,
            bombEvents: bombEvents
        });
    } catch (error) {
        console.error('Error parsing positions:', error);
        res.status(500).json({ error: 'Failed to parse positions', details: error.message, stack: error.stack });
    }
});

// Verify admin password
app.post('/api/auth/verify', requireAdmin, (req, res) => {
    res.json({ ok: true });
});

// Upload a demo file
app.post('/api/demos/upload', requireAdmin, upload.single('demo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        message: 'Demo uploaded successfully',
        name: req.file.originalname,
        size: req.file.size
    });
});

// Delete a demo file
app.delete('/api/demos/:filename', requireAdmin, (req, res) => {
    const { filename } = req.params;
    const filePath = getDemoPath(filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Demo file not found' });
    }

    try {
        fs.unlinkSync(filePath);
        res.json({ message: 'Demo deleted successfully' });
    } catch (error) {
        console.error('Error deleting demo:', error);
        res.status(500).json({ error: 'Failed to delete demo' });
    }
});

// Multer error handling
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large. Maximum size is 1 GB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Only .dem files are allowed') {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDist));

    // SPA fallback: serve index.html for non-API routes
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});