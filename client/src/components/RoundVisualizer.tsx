import React, { useEffect, useState, useRef } from 'react';
import { getPositions, getMapDetails } from '../api';
import type { PlayerPos } from '../types';

interface KillEvent {
    tick: number;
    victimSteamId: string;
    victimName: string;
    attackerName: string;
    weapon: string;
    headshot: boolean;
    x: number;
    y: number;
    z: number;
}

interface ShotEvent {
    tick: number;
    steamid: string;
    weapon: string;
}

interface GrenadeEvent {
    type: 'smoke' | 'fire' | 'he' | 'flash';
    tick: number;
    x: number;
    y: number;
    z: number;
    throwerName: string;
    throwTick: number | null;
    throwPos: { x: number, y: number, z: number } | null;
}

interface BombEvent {
    event_name: 'bomb_pickup' | 'bomb_dropped' | 'bomb_planted' | 'bomb_defused' | 'bomb_exploded';
    tick: number;
    user_steamid: string;
    user_name: string;
    x?: number;
    y?: number;
    z?: number;
}

interface MapConfig {
    pos_x: number;
    pos_y: number;
    scale: number;
    imageUrl: string;
}

interface RoundVisualizerProps {
    filename: string;
    round: {
        round: number;
        startTick: number;
        endTick: number;
    };
    mapName?: string;
    onClose: () => void;
}

export const RoundVisualizer: React.FC<RoundVisualizerProps> = ({ filename, round, mapName, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const [positions, setPositions] = useState<Record<number, PlayerPos[]>>({});
    const [kills, setKills] = useState<KillEvent[]>([]);
    const [shots, setShots] = useState<ShotEvent[]>([]);
    const [grenades, setGrenades] = useState<GrenadeEvent[]>([]);
    const [bombEvents, setBombEvents] = useState<BombEvent[]>([]);
    const [ticks, setTicks] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
    const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
    const [uiTime, setUiTime] = useState(0);
    
    // We use a ref for the current playback time to allow for smooth 60fps interpolation
    const playbackTimeRef = useRef<number>(0); 
    const lastFrameTimeRef = useRef<number>(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | undefined>(undefined);

    const TICK_RATE = 64; // CS2 standard
    const TICK_INTERVAL = 1 / TICK_RATE;

    // Handle Resize
    useEffect(() => {
        if (loading || !containerRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setCanvasSize({ width, height });
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, [loading]);

    // Re-render when canvas size changes to ensure crisp lines
    useEffect(() => {
        render();
    }, [canvasSize]);


    // Load map details and image
    useEffect(() => {
        if (!mapName) {
            setMapConfig(null);
            setMapImage(null);
            return;
        }

        getMapDetails(mapName)
            .then(config => {
                console.log(`Fetched map config for ${mapName}:`, config);
                setMapConfig(config);
                
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = config.imageUrl;
                img.onload = () => {
                    console.log(`Loaded map image for ${mapName}`);
                    setMapImage(img);
                };
                img.onerror = (e) => {
                    console.warn(`Failed to load map image for ${mapName}: ${config.imageUrl}`, e);
                    setMapImage(null);
                };
            })
            .catch(err => {
                console.warn(`Failed to load map details for ${mapName}:`, err);
                setMapConfig(null);
                setMapImage(null);
            });
    }, [mapName]);

    useEffect(() => {
        setLoading(true);
        // Fetch every tick (interval 1) for maximum smoothness
        getPositions(filename, round.startTick, round.endTick, 1)
            .then(data => {
                // Handle new response structure
                const posData = data.positions || data; // Fallback for old API if needed
                const killData = data.kills || [];
                const shotData = data.shots || [];
                const grenadeData = data.grenades || [];
                const bombData = data.bombEvents || [];

                const sortedTicks = Object.keys(posData).map(Number).sort((a, b) => a - b);
                setTicks(sortedTicks);
                setPositions(posData);
                setKills(killData);
                setShots(shotData);
                setGrenades(grenadeData);
                setBombEvents(bombData);
                playbackTimeRef.current = 0;
                setUiTime(0);
            })
            .finally(() => setLoading(false));
    }, [filename, round]);

    const animate = (time: number) => {
        if (!lastFrameTimeRef.current) lastFrameTimeRef.current = time;
        const deltaTime = (time - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = time;

        if (isPlaying) {
            playbackTimeRef.current += deltaTime;
            const maxTime = (ticks.length - 1) * TICK_INTERVAL;
            if (playbackTimeRef.current >= maxTime) {
                playbackTimeRef.current = maxTime;
                setIsPlaying(false);
            }
            // Sync UI time
            setUiTime(playbackTimeRef.current);
        }

        render();
        requestRef.current = requestAnimationFrame(animate);
    };

    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas || ticks.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;

        // Calculate interpolation
        const exactTickIndex = playbackTimeRef.current / TICK_INTERVAL;
        const lowerIndex = Math.floor(exactTickIndex);
        const upperIndex = Math.min(lowerIndex + 1, ticks.length - 1);
        const lerpFactor = exactTickIndex - lowerIndex;

        const tickLower = ticks[lowerIndex];
        const tickUpper = ticks[upperIndex];
        const currentTick = tickLower + lerpFactor;

        const playersLower = positions[tickLower] || [];
        const playersUpper = positions[tickUpper] || [];

        ctx.clearRect(0, 0, width, height);

        let toCanvasX: (x: number) => number;
        let toCanvasY: (y: number) => number;

        if (mapImage && mapConfig) {
             // Draw Map
             // Maintain aspect ratio of the map image (usually 1:1 for radar)
             // Fit into canvas
             const imgSize = Math.min(width, height) * 0.95; // 95% of available space
             const offsetX = (width - imgSize) / 2;
             const offsetY = (height - imgSize) / 2;
             
             // Draw dark background for areas outside map
             ctx.fillStyle = '#0a0a0c';
             ctx.fillRect(0, 0, width, height);

             ctx.drawImage(mapImage, offsetX, offsetY, imgSize, imgSize);

             toCanvasX = (x: number) => {
                 // World to Image
                 const imgX = (x - mapConfig.pos_x) / mapConfig.scale;
                 // Image to Canvas
                 // Note: We assume the image loaded is the full radar image corresponding to the config
                 return offsetX + (imgX / mapImage.naturalWidth) * imgSize; 
             };
             
             toCanvasY = (y: number) => {
                 // World to Image (Y inverted)
                 const imgY = (mapConfig.pos_y - y) / mapConfig.scale;
                 return offsetY + (imgY / mapImage.naturalHeight) * imgSize;
             };

        } else {
            // Dynamic Bounds logic (fallback)
            const allPos = Object.values(positions).flat();
            if (allPos.length === 0) return; // No players?

            const minX = Math.min(...allPos.map(p => p.x)) - 100;
            const maxX = Math.max(...allPos.map(p => p.x)) + 100;
            const minY = Math.min(...allPos.map(p => p.y)) - 100;
            const maxY = Math.max(...allPos.map(p => p.y)) + 100;

            const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
            toCanvasX = (x: number) => (x - minX) * scale;
            toCanvasY = (y: number) => (maxY - y) * scale;
        }

        // Draw Grenades
        // Smoke: 20s (~1280 ticks)
        // Fire: 7s (~448 ticks)
        // HE: 2s (~128 ticks)
        // Flash: 0.5s (~32 ticks)
        grenades.forEach(g => {
            const startT = g.tick;
            let duration = 0;
            if (g.type === 'smoke') duration = 1280;
            else if (g.type === 'fire') duration = 448;
            else if (g.type === 'he') duration = 128; // Doubled again
            else duration = 32;

            // Trajectory / Flight
            if (g.throwTick && g.throwPos && currentTick >= g.throwTick && currentTick < startT) {
                const tx = toCanvasX(g.throwPos.x);
                const ty = toCanvasY(g.throwPos.y);
                const ex = toCanvasX(g.x);
                const ey = toCanvasY(g.y);

                // Draw Path
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(ex, ey);
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw Projectile
                const flightProgress = (currentTick - g.throwTick) / (startT - g.throwTick);
                const px = tx + (ex - tx) * flightProgress;
                const py = ty + (ey - ty) * flightProgress;

                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
                
                // Label Thrower
                if (flightProgress < 0.2) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.font = '9px sans-serif';
                    ctx.fillText(g.throwerName, tx, ty - 10);
                }
            }

            // Detonation
            if (currentTick >= startT && currentTick < startT + duration) {
                const gx = toCanvasX(g.x);
                const gy = toCanvasY(g.y);
                
                // Fade out effect
                const timeLeft = (startT + duration) - currentTick;
                const alpha = Math.min(1, timeLeft / 30); // Fade out last ~0.5s

                if (g.type === 'smoke') {
                    ctx.fillStyle = `rgba(150, 150, 150, ${0.5 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(gx, gy, 26, 0, Math.PI * 2); // Increased (19 -> 26)
                    ctx.fill();
                    ctx.strokeStyle = `rgba(200, 200, 200, ${0.8 * alpha})`;
                    ctx.stroke();
                } else if (g.type === 'fire') {
                    ctx.fillStyle = `rgba(255, 100, 0, ${0.4 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(gx, gy, 22, 0, Math.PI * 2); // Increased (17 -> 22)
                    ctx.fill();
                    // Inner fire
                    ctx.fillStyle = `rgba(255, 200, 50, ${0.6 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(gx, gy, 14, 0, Math.PI * 2); // Increased (11 -> 14)
                    ctx.fill();
                } else if (g.type === 'he') {
                    ctx.fillStyle = `rgba(255, 50, 50, ${0.8 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(gx, gy, 25, 0, Math.PI * 2); // 2.5x (10 -> 25)
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('HE', gx, gy + 3);
                } else if (g.type === 'flash') {
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(gx, gy, 15, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
        
        // Bomb Logic
        const latestBombEvent = bombEvents
            .filter(e => e.tick <= currentTick)
            .sort((a, b) => a.tick - b.tick)
            .pop();

        let carrierId: string | null = null;
        let bombPos: { x: number, y: number } | null = null;
        let bombStatus = 'none'; // none, carried, dropped, planted, exploded, defused

        if (latestBombEvent) {
            if (latestBombEvent.event_name === 'bomb_pickup') {
                bombStatus = 'carried';
                carrierId = latestBombEvent.user_steamid;
            } else if (latestBombEvent.event_name === 'bomb_dropped') {
                bombStatus = 'dropped';
                if (latestBombEvent.x && latestBombEvent.y) {
                    bombPos = { x: latestBombEvent.x, y: latestBombEvent.y };
                }
            } else if (latestBombEvent.event_name === 'bomb_planted') {
                bombStatus = 'planted';
                if (latestBombEvent.x && latestBombEvent.y) {
                    bombPos = { x: latestBombEvent.x, y: latestBombEvent.y };
                }
            } else if (latestBombEvent.event_name === 'bomb_exploded') {
                 bombStatus = 'exploded';
                 // Find plant pos
                 const plantEvent = bombEvents.find(e => e.event_name === 'bomb_planted' && e.tick <= latestBombEvent.tick);
                 if (plantEvent && plantEvent.x && plantEvent.y) {
                     bombPos = { x: plantEvent.x, y: plantEvent.y };
                 }
            } else if (latestBombEvent.event_name === 'bomb_defused') {
                 bombStatus = 'defused';
                 const plantEvent = bombEvents.find(e => e.event_name === 'bomb_planted' && e.tick <= latestBombEvent.tick);
                 if (plantEvent && plantEvent.x && plantEvent.y) {
                     bombPos = { x: plantEvent.x, y: plantEvent.y };
                 }
            }
        }

        // Draw Bomb on Ground (Planted/Dropped/Result)
        if (bombPos && (bombStatus === 'planted' || bombStatus === 'dropped' || bombStatus === 'exploded' || bombStatus === 'defused')) {
             const bx = toCanvasX(bombPos.x);
             const by = toCanvasY(bombPos.y);

             // Draw C4 Icon/Box
             ctx.fillStyle = bombStatus === 'defused' ? '#4f94ff' : '#ff0000';
             if (bombStatus === 'planted') {
                 // Blink
                 const blink = Math.sin(Date.now() / 200) > 0;
                 ctx.fillStyle = blink ? '#ff0000' : '#550000';
             }
             
             ctx.fillRect(bx - 6, by - 8, 12, 16);
             ctx.fillStyle = 'white';
             ctx.font = 'bold 10px sans-serif';
             ctx.textAlign = 'center';
             ctx.fillText('C4', bx, by + 4);

             // Timer for planted
             if (bombStatus === 'planted' && latestBombEvent) {
                 const timePassed = (currentTick - latestBombEvent.tick) / 64;
                 const timeLeft = Math.max(0, 40 - timePassed);
                 
                 ctx.fillStyle = 'white';
                 ctx.font = 'bold 12px monospace';
                 ctx.fillText(timeLeft.toFixed(1), bx, by - 12);
             }
        }

        // Draw Interpolated Players
        playersLower.forEach(pLower => {
            const pUpper = playersUpper.find(u => u.steamid === pLower.steamid) || pLower;
            
            // Linear interpolation for position
            const curX = pLower.x + (pUpper.x - pLower.x) * lerpFactor;
            const curY = pLower.y + (pUpper.y - pLower.y) * lerpFactor;

            // Angular interpolation for yaw
            let diffYaw = pUpper.yaw - pLower.yaw;
            // Shortest path interpolation
            if (diffYaw > 180) diffYaw -= 360;
            if (diffYaw < -180) diffYaw += 360;
            const curYaw = pLower.yaw + diffYaw * lerpFactor;
            
            // Convert Source engine yaw to canvas radians
            // Source: 0 is East (X+), 90 is North (Y+)
            // Canvas: 0 is East (X+), but Y is down.
            // Also map coords might be different.
            // Let's assume standard math first: angle in degrees.
            const rad = (curYaw * Math.PI) / 180;

            const cx = toCanvasX(curX);
            const cy = toCanvasY(curY);

            const isCT = pLower.team === 3;
            const playerColor = isCT ? '#4f94ff' : '#ff914d';
            const shadowColor = isCT ? 'rgba(79, 148, 255, 0.5)' : 'rgba(255, 145, 77, 0.5)';

            // Check if shooting (within last 5 ticks roughly, or 0.1s)
            const currentTick = tickLower + lerpFactor;
            const isShooting = shots.some(s => 
                s.steamid === pLower.steamid && 
                s.tick >= currentTick - 4 && 
                s.tick <= currentTick + 1
            );

            // Draw View Cone (Flashlight style)
            const viewLen = 20;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, viewLen, -rad - 0.4, -rad + 0.4); // Negate rad because Y is flipped in Canvas vs World often, but let's test. 
            // Actually, if we use toCanvasY, it flips Y already. 
            // If World Y+ is North, and Canvas Y+ is South (down).
            // A positive World Yaw (90) points North (World Y+).
            // On canvas, North is Y-.
            // So we likely need to flip the angle sign or offset it.
            // Let's try direct radians first but keep in mind `toCanvasY` logic.
            // `toCanvasY` does `(pos_y - y)`. 
            // So larger Y (North) -> smaller Canvas Y (Up). Correct.
            // Angle 90 (North) -> sin(90)=1. 
            // We want direction (0, -1). 
            // Math: x = cos(a), y = sin(a).
            // cos(90)=0, sin(90)=1. Vector (0, 1). This is Down in canvas.
            // So for 90 degrees to point Up (0, -1), we need sin to be -1.
            // So we probably want -rad.
            
            ctx.fillStyle = `rgba(255, 255, 255, ${isShooting ? 0.3 : 0.1})`;
            ctx.fill();

            // Draw View Line
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(-rad) * viewLen, cy + Math.sin(-rad) * viewLen);
            ctx.strokeStyle = `rgba(255, 255, 255, ${isShooting ? 0.8 : 0.4})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Muzzle flash
            if (isShooting) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = 'yellow';
                ctx.fillStyle = '#ffffaa';
                ctx.beginPath();
                ctx.arc(cx + Math.cos(-rad) * 10, cy + Math.sin(-rad) * 10, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Tracer
            const TRACER_DURATION = 12; // ticks (~0.19s at 64 tick)
            const recentShot = shots
                .filter(s => s.steamid === pLower.steamid && s.tick <= currentTick && s.tick >= currentTick - TRACER_DURATION)
                .sort((a, b) => b.tick - a.tick)[0];

            if (recentShot) {
                const age = currentTick - recentShot.tick;
                const tracerAlpha = Math.max(0, 1 - age / TRACER_DURATION);
                const tracerLen = 80;

                // Use yaw at the time of the shot for accuracy
                const shotPlayers = positions[recentShot.tick];
                const shotPlayer = shotPlayers?.find((p: PlayerPos) => p.steamid === pLower.steamid);
                const shotRad = shotPlayer ? -(shotPlayer.yaw * Math.PI) / 180 : -rad;

                const dx = Math.cos(shotRad);
                const dy = Math.sin(shotRad);

                ctx.shadowBlur = 0;
                const gradient = ctx.createLinearGradient(
                    cx + dx * 10, cy + dy * 10,
                    cx + dx * tracerLen, cy + dy * tracerLen
                );
                gradient.addColorStop(0, `rgba(255, 255, 150, ${tracerAlpha * 0.7})`);
                gradient.addColorStop(1, 'rgba(255, 255, 150, 0)');

                ctx.beginPath();
                ctx.moveTo(cx + dx * 10, cy + dy * 10);
                ctx.lineTo(cx + dx * tracerLen, cy + dy * tracerLen);
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Draw Player Circle
            ctx.shadowBlur = 10;
            ctx.shadowColor = shadowColor;

            ctx.beginPath();
            ctx.arc(cx, cy, 7, 0, Math.PI * 2);
            ctx.fillStyle = playerColor; 
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(pLower.name, cx, cy - 14);

            // Draw C4 if carrier
            if (carrierId === pLower.steamid) {
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(cx + 8, cy - 8, 10, 6);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 6px sans-serif';
                ctx.fillText('C4', cx + 13, cy - 3);
            }
        });

        // Draw Kills
        const visibleKills = kills.filter(k => k.tick <= currentTick);

        visibleKills.forEach(kill => {
            const kx = toCanvasX(kill.x);
            const ky = toCanvasY(kill.y);

            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ff4d4d'; // Red X
            ctx.beginPath();
            const size = 6;
            ctx.moveTo(kx - size, ky - size);
            ctx.lineTo(kx + size, ky + size);
            ctx.moveTo(kx + size, ky - size);
            ctx.lineTo(kx - size, ky + size);
            ctx.stroke();
        });

        // Overlay info - REMOVED from canvas, moved to sidebar
        /*
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`TICK: ${Math.round(tickLower + lerpFactor)}`, 15, 25);
        ctx.fillText(`TIME: ${playbackTimeRef.current.toFixed(2)}s`, 15, 40);
        */
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying, ticks, mapImage, mapConfig]);

    if (loading) return <div className="p-8 text-center text-cs2-accent animate-pulse">Loading high-fidelity data...</div>;

    const progress = (playbackTimeRef.current / ((ticks.length - 1) * TICK_INTERVAL || 1)) * 100;
    const currentTickDisplay = ticks.length > 0 
        ? Math.round(ticks[0] + (playbackTimeRef.current / TICK_INTERVAL)) 
        : 0;

    // Get current players for sidebar
    const exactTickIndexUI = playbackTimeRef.current / TICK_INTERVAL;
    const lowerIndexUI = Math.floor(exactTickIndexUI);
    const tickKeyUI = ticks[lowerIndexUI];
    const currentPlayersUI = positions[tickKeyUI] || [];
    const tPlayers = currentPlayersUI.filter(p => p.team === 2).sort((a,b) => a.name.localeCompare(b.name));
    const ctPlayers = currentPlayersUI.filter(p => p.team === 3).sort((a,b) => a.name.localeCompare(b.name));

    const PlayerCard = ({ p }: { p: PlayerPos }) => (
        <div className="flex items-center space-x-3 bg-white/5 p-2 rounded mb-1 text-xs border-l-2 border-transparent hover:bg-white/10 transition-colors" style={{ borderColor: p.team === 2 ? '#eab308' : '#60a5fa' }}>
            {/* Name & Icons */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center space-x-2">
                    <span className={`font-bold truncate max-w-[120px] ${p.health === 0 ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {p.name}
                    </span>
                    <div className="flex space-x-1 opacity-80">
                        {p.has_defuser && <span className="text-blue-400 text-[10px]" title="Defuser">✂️</span>}
                        {p.has_helmet && <span className="text-gray-300 text-[10px]" title="Helmet">🛡️</span>}
                        {!p.has_helmet && p.armor && p.armor > 0 && <span className="text-gray-500 text-[10px]" title="Armor">🛡️</span>}
                    </div>
                </div>
            </div>

            {/* Health & Armor */}
            <div className="w-24 flex flex-col space-y-1">
                 {/* HP */}
                <div className="relative h-3 bg-gray-800 rounded-sm overflow-hidden">
                    <div 
                        className={`h-full ${p.health && p.health < 20 ? 'bg-red-500' : 'bg-green-500'} transition-all duration-300`} 
                        style={{ width: `${p.health || 0}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white drop-shadow-md">
                        {p.health || 0}
                    </span>
                </div>
                {/* Armor (Small bar or text?) Just text for now to save space, or small bar */}
                <div className="flex justify-end items-center space-x-1 text-[9px] text-gray-400 font-mono">
                    {p.armor && p.armor > 0 && <span>{p.armor} AP</span>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex backdrop-blur-sm">
            {/* Main Area: Map + Controls */}
            <div className="flex-1 flex flex-col h-full relative min-w-0">
                <div 
                    ref={containerRef}
                    className="flex-1 bg-[#0a0a0c] relative overflow-hidden flex items-center justify-center min-h-0 min-w-0"
                >
                    <canvas 
                        ref={canvasRef} 
                        width={canvasSize.width} 
                        height={canvasSize.height} 
                        className="block"
                    />

                    {/* Kill Feed Overlay */}
                    <div className="absolute top-6 right-6 z-20 flex flex-col items-end space-y-1.5 pointer-events-none">
                        {kills
                            .filter(k => k.tick <= currentTickDisplay) 
                            .slice(-12) // Show last 12 kills
                            .map((k, i) => {
                                // Infer teams
                                const attacker = currentPlayersUI.find(p => p.name === k.attackerName);
                                const victim = currentPlayersUI.find(p => p.name === k.victimName);
                                const attColor = attacker ? (attacker.team === 2 ? 'text-yellow-500' : 'text-blue-400') : 'text-white';
                                const vicColor = victim ? (victim.team === 2 ? 'text-yellow-500' : 'text-blue-400') : 'text-white';

                                // Calculate timestamp relative to round start
                                const roundTime = Math.max(0, (k.tick - round.startTick) / 64);
                                const mins = Math.floor(roundTime / 60);
                                const secs = Math.floor(roundTime % 60);
                                const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;

                                return (
                                    <div key={`${k.tick}-${i}`} className="bg-black/70 backdrop-blur text-white px-3 py-1.5 rounded-md flex items-center space-x-3 text-sm border border-white/10 shadow-xl">
                                        <span className="text-[10px] font-mono text-gray-500">[{timestamp}]</span>
                                        {k.attackerName && k.attackerName !== k.victimName ? (
                                            <>
                                                <span className={`font-bold ${attColor}`}>{k.attackerName}</span>
                                                <div className="flex items-center space-x-1 opacity-80">
                                                    <span className="text-gray-300 text-[10px] uppercase font-mono">{k.weapon.replace('weapon_', '')}</span>
                                                    {k.headshot && <span className="text-red-500 text-lg leading-none">⌖</span>}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">Suicide</span>
                                        )}
                                        <span className={`font-bold ${vicColor}`}>{k.victimName}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                {/* Bottom Controls Bar */}
                <div className="h-20 bg-cs2-panel/90 border-t border-white/5 flex items-center px-6 space-x-6 z-10">
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="bg-white/10 hover:bg-cs2-accent text-white w-12 h-12 flex items-center justify-center rounded-xl transition-all group shrink-0"
                    >
                        {isPlaying ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        ) : (
                            <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                    </button>
                    
                    <div className="flex-1 flex flex-col justify-center space-y-2">
                        <div className="flex justify-between text-xs font-mono text-gray-400">
                            <span>START</span>
                            <span>{uiTime.toFixed(1)}s</span>
                        </div>
                        <div className="relative h-2 group cursor-pointer w-full">
                            <input 
                                type="range" 
                                min={0} 
                                max={(ticks.length - 1) * TICK_INTERVAL} 
                                step={0.01}
                                value={uiTime} 
                                onChange={(e) => {
                                    setIsPlaying(false);
                                    const val = parseFloat(e.target.value);
                                    playbackTimeRef.current = val;
                                    setUiTime(val); // Update UI immediately
                                    render();
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            />
                            <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-cs2-accent transition-all duration-75" 
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-cs2-accent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                style={{ left: `${progress}%`, marginLeft: '-8px' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar: Metadata */}
            <div className="w-96 bg-cs2-dark border-l border-white/5 flex flex-col z-20 shadow-xl">
                <div className="p-6 border-b border-white/5 bg-cs2-panel/50">
                    <div className="flex justify-between items-start mb-4">
                        <span className="bg-cs2-accent text-white text-[10px] font-black px-2 py-0.5 rounded tracking-tighter">LIVE FEED</span>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">Round {round.round}</h2>
                    <p className="text-sm text-gray-400 font-mono uppercase tracking-wide">{mapName}</p>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="space-y-6">
                        {/* CT Team */}
                        <div>
                            <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-2 flex justify-between">
                                <span>Counter-Terrorists</span>
                                <span>{ctPlayers.filter(p => (p.health || 0) > 0).length} Alive</span>
                            </div>
                            <div className="space-y-1">
                                {ctPlayers.map(p => <PlayerCard key={p.steamid} p={p} />)}
                            </div>
                        </div>

                        {/* T Team */}
                        <div>
                            <div className="text-xs text-yellow-500 font-bold uppercase tracking-wider mb-2 flex justify-between">
                                <span>Terrorists</span>
                                <span>{tPlayers.filter(p => (p.health || 0) > 0).length} Alive</span>
                            </div>
                            <div className="space-y-1">
                                {tPlayers.map(p => <PlayerCard key={p.steamid} p={p} />)}
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Tick Info</div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-400">Current Tick</span>
                                <span className="font-mono text-white">{currentTickDisplay}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Time</span>
                                <span className="font-mono text-cs2-accent">{playbackTimeRef.current.toFixed(2)}s</span>
                            </div>
                        </div>

                        {/* Future: Kill Feed could go here */}
                         <div className="bg-white/5 rounded-lg p-4">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Kill Feed</div>
                            <div className="space-y-2 text-xs">
                                {kills.filter(k => k.tick <= currentTickDisplay).reverse().map((kill, i) => (
                                    <div key={i} className="flex items-center space-x-2 text-gray-300">
                                        <span className="text-red-400 font-bold">☠</span>
                                        <span>{kill.attackerName || 'World'}</span>
                                        <span className="text-gray-600">&rarr;</span>
                                        <span className={kill.headshot ? "text-yellow-500" : ""}>{kill.victimName}</span>
                                    </div>
                                ))}
                                {kills.filter(k => k.tick <= currentTickDisplay).length === 0 && (
                                    <div className="text-gray-600 italic">No kills yet...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};