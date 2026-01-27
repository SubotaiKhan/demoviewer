import React from 'react';
import clsx from 'clsx';
import { DemoUpload } from './DemoUpload';
import { deleteDemo } from '../api';

interface DemoPlayer {
    name: string;
    team: number; // 2=T, 3=CT
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
            <ul className="space-y-3">
                {demos.map((demo) => {
                    const selected = selectedDemo === demo.name;
                    const ctPlayers = demo.players?.filter(p => p.team === 3) ?? [];
                    const tPlayers = demo.players?.filter(p => p.team === 2) ?? [];

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

                            {/* Score */}
                            {demo.score && (
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

                            {/* Players */}
                            {demo.players && demo.players.length > 0 && (
                                <div className="text-[11px] leading-relaxed space-y-1 mb-2">
                                    <div className="flex gap-1.5 flex-wrap">
                                        <span className="text-cs2-ct font-semibold shrink-0">CT</span>
                                        <span className="text-gray-400 truncate">
                                            {ctPlayers.map(p => p.name).join(', ') || '-'}
                                        </span>
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                        <span className="text-cs2-t font-semibold shrink-0">T</span>
                                        <span className="text-gray-400 truncate">
                                            {tPlayers.map(p => p.name).join(', ') || '-'}
                                        </span>
                                    </div>
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
