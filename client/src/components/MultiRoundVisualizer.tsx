import { useEffect, useRef, useState } from 'react';
import { getMapDetails, getPositions } from '../api';
import type { PlayerPos } from '../types';

interface MultiRoundVisualizerProps {
    filename: string;
    mapName: string;
    rounds: any[];
    players: any[];
    onClose: () => void;
}

export const MultiRoundVisualizer = ({ filename, mapName, rounds, players, onClose }: MultiRoundVisualizerProps) => {
    // State
    const [selectedRoundIds, setSelectedRoundIds] = useState<Set<number>>(new Set());
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
    const [roundDataCache, setRoundDataCache] = useState<Record<number, any>>({});
    const [, setLoadingRounds] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    
    const [mapMeta, setMapMeta] = useState<any>(null);
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

    // Playback
    const [time, setTime] = useState(0); // Seconds from round start
    const [isPlaying, setIsPlaying] = useState(false);
    const lastFrameTime = useRef<number>(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 800 });

    // Load Map
    useEffect(() => {
        getMapDetails(mapName).then(data => {
            setMapMeta(data);
            const img = new Image();
            img.src = `/maps/${mapName}/${mapName}_radar_psd.png`;
            img.onload = () => setBgImage(img);
        }).catch(err => console.error("Failed to load map:", err));
    }, [mapName]);

    // Resize Observer
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setCanvasSize({ width, height });
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Background Prefetcher (Load ALL rounds)
    useEffect(() => {
        let isCancelled = false;
        
        const loadAll = async () => {
            const roundsToLoad = rounds.filter(r => !roundDataCache[r.round]);
            setProgress({ current: rounds.length - roundsToLoad.length, total: rounds.length });

            // Process one by one to avoid choking the browser/network
            for (const round of roundsToLoad) {
                if (isCancelled) break;
                
                // Check cache again in case it was loaded elsewhere
                if (roundDataCache[round.round]) {
                    setProgress(p => ({ ...p, current: p.current + 1 }));
                    continue;
                }

                setLoadingRounds(prev => new Set(prev).add(round.round));
                try {
                    // Interval 4 for high quality
                    const data = await getPositions(filename, round.startTick, round.endTick, 4);
                    
                    if (!isCancelled) {
                        setRoundDataCache(prev => ({
                            ...prev,
                            [round.round]: {
                                ...data,
                                startTick: round.startTick
                            }
                        }));
                        setProgress(p => ({ ...p, current: p.current + 1 }));
                    }
                } catch (err) {
                    console.error(`Failed to load round ${round.round}`, err);
                } finally {
                    if (!isCancelled) {
                        setLoadingRounds(prev => {
                            const next = new Set(prev);
                            next.delete(round.round);
                            return next;
                        });
                    }
                }
            }
        };

        loadAll();

        return () => { isCancelled = true; };
    }, [filename, rounds]); // Run once on mount (or if demo changes)

    // Animation Loop
    useEffect(() => {
        let animationFrameId: number;

        const loop = (timestamp: number) => {
            if (!lastFrameTime.current) lastFrameTime.current = timestamp;
            const delta = (timestamp - lastFrameTime.current) / 1000;
            lastFrameTime.current = timestamp;

            if (isPlaying) {
                setTime(t => {
                    const next = t + delta;
                    if (next > 180) { // Auto loop or stop at 3m
                        setIsPlaying(false);
                        return 0;
                    }
                    return next;
                });
            }

            renderCanvas();
            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, mapMeta, bgImage, roundDataCache, selectedRoundIds, selectedPlayerIds, time, canvasSize]);

    // Render Logic
    const renderCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !mapMeta || !bgImage) return;

        // Clear
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Map Transform
        const { pos_x, pos_y, scale } = mapMeta;
        // Fit map to canvas
        const mapW = bgImage.width;
        const mapH = bgImage.height;
        
        // Scale to fit
        const scaleX = canvas.width / mapW;
        const scaleY = canvas.height / mapH;
        const fitScale = Math.min(scaleX, scaleY);
        
        const drawW = mapW * fitScale;
        const drawH = mapH * fitScale;
        const offsetX = (canvas.width - drawW) / 2;
        const offsetY = (canvas.height - drawH) / 2;

        ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH);

        const worldToScreen = (wx: number, wy: number) => {
            const x = (wx - pos_x) / scale;
            const y = (pos_y - wy) / scale; // Invert Y
            return {
                x: offsetX + x * fitScale,
                y: offsetY + y * fitScale
            };
        };

        // Draw Players from Selected Rounds
        selectedRoundIds.forEach(rId => {
            const data = roundDataCache[rId];
            if (!data) return;

            // Calculate current tick for this round
            const tickRate = 64; // Default guess
            const targetTick = data.startTick + (time * tickRate);
            
            // Get sorted ticks
            // Optimization: Cache this sorted array? For now it's okay.
            const ticks = Object.keys(data.positions).map(Number).sort((a,b) => a-b);
            if (ticks.length === 0) return;

            // Find interpolation range
            let index = -1;
            // Binary search or simple loop? Simple loop is fast enough for <1000 items usually.
            for (let i = 0; i < ticks.length - 1; i++) {
                if (ticks[i] <= targetTick && ticks[i+1] > targetTick) {
                    index = i;
                    break;
                }
            }

            let interpolatedPlayers: any[] = [];

            if (index !== -1) {
                // Interpolate
                const tickA = ticks[index];
                const tickB = ticks[index+1];
                const factor = (targetTick - tickA) / (tickB - tickA);
                
                const playersA: PlayerPos[] = data.positions[tickA] || [];
                const playersB: PlayerPos[] = data.positions[tickB] || [];

                // Map players by steamid
                const mapB = new Map(playersB.map(p => [p.steamid, p]));

                playersA.forEach(pA => {
                    const pB = mapB.get(pA.steamid);
                    if (pB) {
                        // Lerp
                        interpolatedPlayers.push({
                            ...pA,
                            x: pA.x + (pB.x - pA.x) * factor,
                            y: pA.y + (pB.y - pA.y) * factor
                        });
                    } else {
                        // Player disappeared (died/disconnected), just show pA
                        interpolatedPlayers.push(pA);
                    }
                });
            } else {
                // Out of range or end of stream, clamp to nearest
                if (targetTick < ticks[0]) {
                    interpolatedPlayers = data.positions[ticks[0]] || [];
                } else {
                    interpolatedPlayers = data.positions[ticks[ticks.length - 1]] || [];
                }
            }

            interpolatedPlayers.forEach(p => {
                if (!selectedPlayerIds.has(p.steamid)) return;

                const screen = worldToScreen(p.x, p.y);
                
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = p.team === 2 ? '#eab308' : '#60a5fa'; // T Yellow, CT Blue
                ctx.globalAlpha = 0.8;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                
                // Outline
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        });
    };

    const toggleRound = (r: number) => {
        const next = new Set(selectedRoundIds);
        if (next.has(r)) next.delete(r);
        else next.add(r);
        setSelectedRoundIds(next);
    };

    const togglePlayer = (id: string) => {
        const next = new Set(selectedPlayerIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPlayerIds(next);
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex backdrop-blur-sm">
            {/* Left Sidebar: Rounds */}
            <div className="w-64 bg-cs2-dark border-r border-white/5 flex flex-col">
                <div className="p-4 border-b border-white/5 font-bold text-white flex justify-between items-center">
                    <span>Rounds</span>
                    <button onClick={() => setSelectedRoundIds(new Set())} className="text-xs text-gray-400 hover:text-white">Clear</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {rounds.map(r => (
                        <div 
                            key={r.round} 
                            onClick={() => toggleRound(r.round)}
                            className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center ${selectedRoundIds.has(r.round) ? 'bg-cs2-accent text-white' : 'hover:bg-white/5 text-gray-400'}`}
                        >
                            <span>Round {r.round}</span>
                            <span className="text-xs opacity-50">{r.winner === 2 ? 'T' : 'CT'}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Center: Canvas & Controls */}
            <div className="flex-1 flex flex-col relative min-w-0">
                 {/* Top Bar */}
                 <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
                    <div className="bg-black/50 p-2 rounded text-white pointer-events-auto">
                        <h2 className="font-bold">Ghost Analysis</h2>
                        <p className="text-xs text-gray-400">Select rounds and players to overlay movements.</p>
                        
                        {/* Caching Progress */}
                        <div className="mt-2 text-[10px] text-gray-400 font-mono flex items-center space-x-2">
                            <span>CACHING DATA</span>
                            <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-green-500 transition-all duration-300" 
                                    style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                                />
                            </div>
                            <span>{progress.current}/{progress.total}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded pointer-events-auto">
                        Close
                    </button>
                 </div>

                <div ref={containerRef} className="flex-1 bg-[#0a0a0c] flex items-center justify-center relative">
                    <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} />
                </div>

                {/* Bottom Timeline */}
                <div className="h-16 bg-cs2-panel border-t border-white/5 flex items-center px-4 space-x-4">
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-cs2-accent hover:bg-blue-600 text-white transition-colors"
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <div className="flex-1">
                        <input 
                            type="range" 
                            min="0" 
                            max="180" 
                            step="0.1"
                            value={time} 
                            onChange={(e) => {
                                setIsPlaying(false);
                                setTime(parseFloat(e.target.value));
                            }}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                            <span>0:00</span>
                            <span>{Math.floor(time / 60)}:{(time % 60).toFixed(0).padStart(2, '0')}</span>
                            <span>3:00</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar: Players */}
            <div className="w-64 bg-cs2-dark border-l border-white/5 flex flex-col">
                <div className="p-4 border-b border-white/5 font-bold text-white flex justify-between items-center">
                    <span>Players</span>
                    <div className="space-x-2 text-xs">
                        <button onClick={() => setSelectedPlayerIds(new Set())} className="text-gray-400 hover:text-white">Clear</button>
                        <button onClick={() => setSelectedPlayerIds(new Set(players.map(p => p.steamid)))} className="text-gray-400 hover:text-white">All</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {players.map(p => (
                        <div 
                            key={p.steamid} 
                            onClick={() => togglePlayer(p.steamid)}
                            className={`p-2 rounded cursor-pointer text-sm flex items-center space-x-2 ${selectedPlayerIds.has(p.steamid) ? 'bg-white/10 text-white border-l-2 border-cs2-accent' : 'hover:bg-white/5 text-gray-400'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${p.team === 2 ? 'bg-yellow-500' : 'bg-blue-400'}`}></span>
                            <span className="truncate">{p.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
