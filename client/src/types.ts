export interface PlayerStats {
    steamid: string;
    name: string;
    team: number; // 2=T, 3=CT
    kills: number;
    deaths: number;
    assists: number;
    headshots: number;
    damage: number;
    adr: string | number;
    [key: string]: any; // Allow for dynamic extension
}

export interface MatchStats {
    score: {
        ct: number;
        t: number;
    };
    players: PlayerStats[];
    totalRounds: number;
    rounds: RoundInfo[];
}

export interface RoundInfo {
    round: number;
    winner: number; // 2 or 3
    reason: string;
    tick: number;
    startTick: number;
    endTick: number;
}

export interface TeamNames {
    ctTeam: string;
    tTeam: string;
}

export interface MatchData {
    header: any;
    matchStats: MatchStats;
    teams: TeamNames | null;
}

export interface PlayerPos {
    steamid: string;
    name: string;
    team: number;
    yaw: number;
    x: number;
    y: number;
    z: number;
    health?: number;
    armor?: number;
    has_helmet?: boolean;
    has_defuser?: boolean;
    flash_duration?: number; // Remaining flash duration in seconds
    active_weapon_name?: string; // Currently equipped weapon
    inventory?: string[]; // Full loadout (weapons and utility)
}