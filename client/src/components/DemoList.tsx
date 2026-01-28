import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { DemoUpload } from './DemoUpload';
import { deleteDemo } from '../api';

interface DemoPlayer {
    name: string;
    startingTeam: number; // 2=T, 3=CT (the side they started on = their organization)
}

interface Demo {
    name: string;
    size: number;
    created: string;
    map?: string;
    duration?: number;
    score?: { ct: number; t: number };
    totalRounds?: number;
    players?: DemoPlayer[];
    teams?: { ctTeam: string; tTeam: string } | null;
}

interface Props {
    demos: Demo[];
    onSelect: (filename: string) => void;
    selectedDemo: string | null;
    onRefresh: () => void;
    adminPassword: string | null;
}

export const DemoList: React.FC<Props> = ({ demos, onSelect, selectedDemo, onRefresh, adminPassword }) => {
    const isAdmin = !!adminPassword;
    const [filterText, setFilterText] = useState('');

    // Filter demos based on search text (matches player names, map, filename)
    const filteredDemos = useMemo(() => {
        if (!filterText.trim()) return demos;

        const searchLower = filterText.toLowerCase().trim();

        return demos.filter(demo => {
            // Match filename
            if (demo.name.toLowerCase().includes(searchLower)) return true;

            // Match map name
            if (demo.map?.toLowerCase().includes(searchLower)) return true;

            // Match team names
            if (demo.teams?.ctTeam.toLowerCase().includes(searchLower)) return true;
            if (demo.teams?.tTeam.toLowerCase().includes(searchLower)) return true;

            // Match any player name
            if (demo.players?.some(p => p.name.toLowerCase().includes(searchLower))) return true;

            return false;
        });
    }, [demos, filterText]);

    // Get unique team names
    const allTeams = useMemo(() => {
        const teams = new Set<string>();
        demos.forEach(demo => {
            if (demo.teams?.ctTeam) teams.add(demo.teams.ctTeam);
            if (demo.teams?.tTeam) teams.add(demo.teams.tTeam);
        });
        return Array.from(teams).sort();
    }, [demos]);

    // Get unique player names for autocomplete suggestions
    const allPlayerNames = useMemo(() => {
        const names = new Set<string>();
        demos.forEach(demo => {
            demo.players?.forEach(p => names.add(p.name));
        });
        return Array.from(names).sort();
    }, [demos]);

    // Get unique maps
    const allMaps = useMemo(() => {
        const maps = new Set<string>();
        demos.forEach(demo => {
            if (demo.map) maps.add(demo.map);
        });
        return Array.from(maps).sort();
    }, [demos]);

    const handleDelete = async (e: React.MouseEvent, filename: string) => {
        e.stopPropagation();
        if (!adminPassword) return;
        if (!confirm(`Delete ${filename}?`)) return;
        try {
            await deleteDemo(filename, adminPassword);
            onRefresh();
        } catch (err) {
            console.error('Failed to delete demo:', err);
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="bg-cs2-panel p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-cs2-accent">Available Demos</h2>

            {/* Filter input */}
            <div className="mb-4">
                <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter by player, map, or filename..."
                    className="w-full bg-black/40 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cs2-accent"
                    list="filter-suggestions"
                />
                <datalist id="filter-suggestions">
                    {allTeams.map(team => (
                        <option key={`team-${team}`} value={team} />
                    ))}
                    {allMaps.map(map => (
                        <option key={`map-${map}`} value={map} />
                    ))}
                    {allPlayerNames.slice(0, 10).map(name => (
                        <option key={`player-${name}`} value={name} />
                    ))}
                </datalist>
                {filterText && (
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">
                            {filteredDemos.length} of {demos.length} demos
                        </span>
                        <button
                            onClick={() => setFilterText('')}
                            className="text-xs text-gray-500 hover:text-white"
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Quick team filters */}
                {allTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {allTeams.map(team => (
                            <button
                                key={team}
                                onClick={() => setFilterText(team)}
                                className={clsx(
                                    "px-2 py-0.5 text-[10px] rounded transition-colors",
                                    filterText.toLowerCase() === team.toLowerCase()
                                        ? "bg-cs2-accent text-black"
                                        : "bg-black/30 text-gray-400 hover:bg-black/50 hover:text-white"
                                )}
                            >
                                {team}
                            </button>
                        ))}
                    </div>
                )}

                {/* Quick map filters */}
                {allMaps.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {allMaps.map(map => (
                            <button
                                key={map}
                                onClick={() => setFilterText(map)}
                                className={clsx(
                                    "px-2 py-0.5 text-[10px] rounded transition-colors",
                                    filterText.toLowerCase() === map.toLowerCase()
                                        ? "bg-purple-500 text-white"
                                        : "bg-black/30 text-gray-500 hover:bg-black/50 hover:text-white"
                                )}
                            >
                                {map.replace('de_', '')}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ul className="space-y-3">
                {filteredDemos.map((demo) => {
                    const selected = selectedDemo === demo.name;
                    // Players grouped by starting team (their organization)
                    // ctTeam started as CT (startingTeam 3), tTeam started as T (startingTeam 2)
                    const ctTeamPlayers = demo.players?.filter(p => p.startingTeam === 3) ?? [];
                    const tTeamPlayers = demo.players?.filter(p => p.startingTeam === 2) ?? [];
                    const ctTeamScore = demo.score?.ct ?? 0;
                    const tTeamScore = demo.score?.t ?? 0;

                    return (
                        <li
                            key={demo.name}
                            onClick={() => onSelect(demo.name)}
                            className={clsx(
                                "p-4 rounded-lg transition-colors cursor-pointer border",
                                selected
                                    ? "bg-cs2-accent/10 border-cs2-accent"
                                    : "bg-black/20 hover:bg-black/40 border-transparent"
                            )}
                        >
                            {/* Top row: map + date + delete */}
                            <div className="flex justify-between items-start mb-2">
                                <span className={clsx(
                                    "font-bold text-sm uppercase tracking-wide",
                                    selected ? "text-cs2-accent" : "text-white"
                                )}>
                                    {demo.map || demo.name}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-gray-500">
                                        {formatDate(demo.created)}
                                    </span>
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => handleDelete(e, demo.name)}
                                            className="text-xs px-1.5 py-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors text-gray-600"
                                            title="Delete demo"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Team names with scores */}
                            {demo.teams && demo.score && (
                                <div className="mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "font-bold text-lg font-mono w-6",
                                            ctTeamScore > tTeamScore ? "text-green-400" : ctTeamScore < tTeamScore ? "text-red-400" : "text-gray-400"
                                        )}>
                                            {ctTeamScore}
                                        </span>
                                        <span className="text-white text-sm truncate">{demo.teams.ctTeam}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "font-bold text-lg font-mono w-6",
                                            tTeamScore > ctTeamScore ? "text-green-400" : tTeamScore < ctTeamScore ? "text-red-400" : "text-gray-400"
                                        )}>
                                            {tTeamScore}
                                        </span>
                                        <span className="text-white text-sm truncate">{demo.teams.tTeam}</span>
                                    </div>
                                </div>
                            )}

                            {/* Players grouped by team */}
                            {demo.players && demo.players.length > 0 && (
                                <div className="text-[11px] leading-relaxed space-y-1 mb-2">
                                    <div className="text-gray-400 truncate">
                                        {ctTeamPlayers.map(p => p.name).join(', ') || '-'}
                                    </div>
                                    <div className="text-gray-500 truncate">
                                        {tTeamPlayers.map(p => p.name).join(', ') || '-'}
                                    </div>
                                </div>
                            )}

                            {/* Fallback: Score when no team names */}
                            {!demo.teams && demo.score && (
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-cs2-ct tracking-wider">CT</span>
                                        <span className="text-cs2-ct font-bold text-xl font-mono">{demo.score.ct}</span>
                                    </div>
                                    <span className="text-gray-600 text-sm">-</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-cs2-t font-bold text-xl font-mono">{demo.score.t}</span>
                                        <span className="text-[10px] uppercase font-bold text-cs2-t tracking-wider">T</span>
                                    </div>
                                    {demo.totalRounds && (
                                        <span className="text-[10px] text-gray-600 ml-auto">
                                            {demo.totalRounds} rounds
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Bottom row: filename, size, duration */}
                            <div className="flex justify-between items-center text-[10px] text-gray-600 border-t border-white/5 pt-2">
                                <span className="font-mono truncate mr-2">{demo.name}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                    {demo.duration != null && (
                                        <span>{formatDuration(demo.duration)}</span>
                                    )}
                                    <span>{(demo.size / 1024 / 1024).toFixed(1)} MB</span>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
            {isAdmin && <DemoUpload onUploadComplete={onRefresh} adminPassword={adminPassword} />}
        </div>
    );
};
