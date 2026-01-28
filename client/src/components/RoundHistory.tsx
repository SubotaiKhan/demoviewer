import React from 'react';
import clsx from 'clsx';
import type { TeamNames } from '../types';

interface Round {
    round: number;
    winner: number; // 2=T, 3=CT
    reason: string;
    tick: number;
}

interface Props {
    rounds: Round[];
    onViewRound: (round: Round) => void;
    teams?: TeamNames | null;
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

export const RoundHistory: React.FC<Props> = ({ rounds, onViewRound, teams }) => {
    // Group rounds by half/overtime
    const firstHalf = rounds.filter(r => r.round <= 12);
    const secondHalf = rounds.filter(r => r.round > 12 && r.round <= 24);
    const overtime = rounds.filter(r => r.round > 24);

    // Calculate scores for each half
    const getHalfScore = (halfRounds: Round[]) => {
        let ctWins = 0;
        let tWins = 0;
        halfRounds.forEach(r => {
            if (r.winner === 3) ctWins++;
            else if (r.winner === 2) tWins++;
        });
        return { ct: ctWins, t: tWins };
    };

    const firstHalfScore = getHalfScore(firstHalf);
    const secondHalfScore = getHalfScore(secondHalf);
    const otScore = getHalfScore(overtime);

    const RoundCard = ({ round }: { round: Round }) => {
        const isCT = round.winner === 3;
        return (
            <div className={clsx(
                "flex items-center justify-between p-3 rounded border-l-4 bg-black/20 group hover:bg-black/40 transition-colors",
                isCT ? "border-cs2-ct" : "border-cs2-t"
            )}>
                <div className="flex items-center space-x-3">
                    <span className="font-mono text-gray-500 font-bold">#{round.round}</span>
                    <div className="flex flex-col">
                        <span className={clsx(
                            "font-bold text-sm",
                            isCT ? "text-cs2-ct" : "text-cs2-t"
                        )}>
                            {isCT ? (teams?.ctTeam || 'CT') : (teams?.tTeam || 'T')}
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
    };

    const HalfDivider = ({ label, score }: { label: string; score: { ct: number; t: number } }) => (
        <div className="col-span-full flex items-center gap-4 py-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
            <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-cs2-ct">{teams?.ctTeam || 'CT'}: {score.ct}</span>
                    <span className="text-gray-600">-</span>
                    <span className="text-cs2-t">{teams?.tTeam || 'T'}: {score.t}</span>
                </div>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
        </div>
    );

    return (
        <div className="bg-cs2-panel p-6 rounded-lg shadow-lg mt-4">
            <h3 className="text-xl font-bold text-white mb-4">Round History</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {firstHalf.length > 0 && (
                    <>
                        <HalfDivider label="First Half" score={firstHalfScore} />
                        {firstHalf.map(round => <RoundCard key={round.round} round={round} />)}
                    </>
                )}

                {secondHalf.length > 0 && (
                    <>
                        <HalfDivider label="Second Half" score={secondHalfScore} />
                        {secondHalf.map(round => <RoundCard key={round.round} round={round} />)}
                    </>
                )}

                {overtime.length > 0 && (
                    <>
                        <HalfDivider label="Overtime" score={otScore} />
                        {overtime.map(round => <RoundCard key={round.round} round={round} />)}
                    </>
                )}
            </div>
        </div>
    );
};
