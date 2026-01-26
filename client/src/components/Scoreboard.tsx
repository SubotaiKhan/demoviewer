import React from 'react';
import clsx from 'clsx';
import type { MatchData } from '../types';

export const Scoreboard: React.FC<{ data: MatchData }> = ({ data }) => {
    const { matchStats, header } = data;
    
    // Sort by kills (desc)
    const sortedPlayers = [...matchStats.players].sort((a, b) => b.kills - a.kills);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-cs2-panel p-6 rounded-lg shadow-lg mt-4 font-sans">
            {/* Header: Map & Score */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-wide uppercase">{header.map_name}</h2>
                    <div className="text-gray-400 text-sm mt-1">
                        {header.server_name}
                    </div>
                </div>
                
                <div className="flex items-center space-x-8">
                    <div className="flex flex-col items-center">
                        <span className="text-cs2-ct font-bold text-4xl">{matchStats.score.ct}</span>
                        <span className="text-cs2-ct text-xs tracking-widest uppercase font-bold">CT</span>
                    </div>
                    <div className="text-gray-600 text-2xl font-light">-</div>
                    <div className="flex flex-col items-center">
                        <span className="text-cs2-t font-bold text-4xl">{matchStats.score.t}</span>
                        <span className="text-cs2-t text-xs tracking-widest uppercase font-bold">TERRORIST</span>
                    </div>
                </div>

                <div className="text-right">
                     <div className="text-gray-400 font-mono text-lg">{formatDuration(header.playback_time)}</div>
                     <div className="text-xs text-gray-500 uppercase tracking-wider">Duration</div>
                </div>
            </div>

            {/* Scoreboard Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-700">
                            <th className="pb-3 pl-4">Player</th>
                            <th className="pb-3 text-center">K</th>
                            <th className="pb-3 text-center">A</th>
                            <th className="pb-3 text-center">D</th>
                            <th className="pb-3 text-center" title="Average Damage per Round">ADR</th>
                            <th className="pb-3 text-center">HS%</th>
                            <th className="pb-3 text-center">K/D</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {sortedPlayers.map(player => {
                            const isCT = player.team === 3;
                            const kd = player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills.toFixed(2);
                            const hsPercent = player.kills > 0 ? Math.round((player.headshots / player.kills) * 100) : 0;

                            return (
                                <tr key={player.steamid} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                                    <td className="py-3 pl-4 flex items-center space-x-3">
                                        <div className={clsx(
                                            "w-1 h-8 rounded-full",
                                            isCT ? "bg-cs2-ct" : "bg-cs2-t"
                                        )}></div>
                                        <span className={clsx(
                                            "font-medium text-lg truncate max-w-[200px]",
                                            isCT ? "text-blue-100" : "text-yellow-100"
                                        )}>
                                            {player.name}
                                        </span>
                                    </td>
                                    <td className="py-3 text-center font-bold text-white">{player.kills}</td>
                                    <td className="py-3 text-center text-gray-400">{player.assists}</td>
                                    <td className="py-3 text-center text-red-400">{player.deaths}</td>
                                    <td className="py-3 text-center text-gray-300 font-mono">{player.adr}</td>
                                    <td className="py-3 text-center text-gray-400 font-mono">{hsPercent}%</td>
                                    <td className={clsx("py-3 text-center font-mono font-bold", 
                                        Number(kd) >= 1 ? "text-green-400" : "text-gray-500"
                                    )}>
                                        {kd}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
