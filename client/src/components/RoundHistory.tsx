import React from 'react';
import clsx from 'clsx';

interface Round {
    round: number;
    winner: number; // 2=T, 3=CT
    reason: string;
    tick: number;
}

const REASON_MAP: Record<string, string> = {
    'target_bombed': 'Bomb Exploded',
    'bomb_defused': 'Bomb Defused',
    't_killed': 'Terrorists Eliminated',
    'ct_killed': 'CTs Eliminated',
    'time_ran_out': 'Time Expired',
    'ct_surrender': 'CT Surrender',
    't_surrender': 'T Surrender'
};

export const RoundHistory: React.FC<{ rounds: Round[], onViewRound: (round: Round) => void }> = ({ rounds, onViewRound }) => {
    return (
        <div className="bg-cs2-panel p-6 rounded-lg shadow-lg mt-4">
            <h3 className="text-xl font-bold text-white mb-4">Round History</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {rounds.map((round) => {
                    const isCT = round.winner === 3;
                    
                    return (
                        <div key={round.round} className={clsx(
                            "flex items-center justify-between p-3 rounded border-l-4 bg-black/20 group hover:bg-black/40 transition-colors",
                            isCT ? "border-cs2-ct" : "border-cs2-t"
                        )}>
                            <div className="flex items-center space-x-3">
                                <span className="font-mono text-gray-500 font-bold">#{round.round}</span>
                                <div className="flex flex-col">
                                    <span className={clsx(
                                        "font-bold text-sm uppercase",
                                        isCT ? "text-cs2-ct" : "text-cs2-t"
                                    )}>
                                        {isCT ? 'CT Win' : 'T Win'}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-medium uppercase">
                                        {REASON_MAP[round.reason] || round.reason}
                                    </span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => onViewRound(round)}
                                className="opacity-0 group-hover:opacity-100 bg-white/10 hover:bg-white/20 text-white text-[10px] px-2 py-1 rounded transition-all uppercase font-bold"
                            >
                                Analyze
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
