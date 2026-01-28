import { useEffect, useState } from 'react';
import { getDemos, getDemoDetails, verifyAdminPassword } from './api';
import { DemoList } from './components/DemoList';
import { Scoreboard } from './components/Scoreboard';
import { RoundHistory } from './components/RoundHistory';
import { RoundVisualizer } from './components/RoundVisualizer';
import { MultiRoundVisualizer } from './components/MultiRoundVisualizer';

function App() {
    const [demos, setDemos] = useState([]);
    const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
    const [matchData, setMatchData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedRound, setSelectedRound] = useState<any>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [adminPassword, setAdminPassword] = useState<string | null>(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);

    const refreshDemos = () => {
        getDemos().then(setDemos).catch(console.error);
    };

    useEffect(() => {
        refreshDemos();
    }, []);

    const handleSelectDemo = async (filename: string) => {
        setSelectedDemo(filename);
        setLoading(true);
        setMatchData(null); // Reset previous data
        setSelectedRound(null);
        setShowAnalysis(false);
        try {
            const data = await getDemoDetails(filename);
            setMatchData(data);
        } catch (error) {
            console.error(error);
            alert('Failed to load demo');
        } finally {
            setLoading(false);
        }
    };

    const handleViewRound = (round: any) => {
        setSelectedRound(round);
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        try {
            await verifyAdminPassword(passwordInput);
            setAdminPassword(passwordInput);
            setPasswordInput('');
        } catch {
            setAuthError('Wrong password');
        }
    };

    return (
        <div className="min-h-screen bg-cs2-dark text-cs2-text p-8">
            <header className="mb-8">
                <h1 className="text-4xl font-black text-cs2-accent tracking-tighter">CS2<span className="text-white">DEMO</span>VIEWER</h1>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <DemoList demos={demos} onSelect={handleSelectDemo} selectedDemo={selectedDemo} onRefresh={refreshDemos} adminPassword={adminPassword} />

                    {/* Admin login */}
                    <div className="mt-4 bg-cs2-panel p-4 rounded-lg shadow-lg">
                        {adminPassword ? (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-green-400">Admin mode</span>
                                <button
                                    onClick={() => setAdminPassword(null)}
                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleAdminLogin} className="space-y-2">
                                <label className="text-xs text-gray-500 block">Admin password</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        className="flex-1 bg-black/40 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cs2-accent"
                                        placeholder="Password"
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 py-1 bg-cs2-accent text-black text-sm font-bold rounded hover:bg-cs2-accent/80 transition-colors"
                                    >
                                        Login
                                    </button>
                                </div>
                                {authError && <p className="text-xs text-red-400">{authError}</p>}
                            </form>
                        )}
                    </div>
                </div>
                
                <div className="lg:col-span-3 space-y-4">
                    {loading && <div className="text-center p-8 animate-pulse text-cs2-accent">Parsing Demo...</div>}
                    
                    {!loading && matchData && (
                        <>
                            <Scoreboard data={matchData} />
                            
                            <div className="flex justify-between items-center bg-cs2-panel p-4 rounded border border-white/5">
                                <h3 className="font-bold text-white">Match Analysis</h3>
                                <button 
                                    onClick={() => setShowAnalysis(true)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-sm transition-colors flex items-center space-x-2"
                                >
                                    <span>👻 Ghost Analysis</span>
                                </button>
                            </div>

                            {matchData.matchStats.rounds && (
                                <RoundHistory
                                    rounds={matchData.matchStats.rounds}
                                    onViewRound={handleViewRound}
                                    teams={matchData.teams}
                                />
                            )}
                        </>
                    )}
                    
                    {!loading && !matchData && (
                        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg text-gray-500">
                            Select a demo to view statistics
                        </div>
                    )}
                </div>
            </div>

            {selectedRound && selectedDemo && (
                <RoundVisualizer
                    filename={selectedDemo}
                    round={selectedRound}
                    rounds={matchData?.matchStats?.rounds}
                    mapName={matchData?.header?.map_name}
                    teams={matchData?.teams}
                    onClose={() => setSelectedRound(null)}
                    onChangeRound={handleViewRound}
                />
            )}

            {showAnalysis && selectedDemo && matchData && (
                <MultiRoundVisualizer
                    filename={selectedDemo}
                    mapName={matchData.header.map_name}
                    rounds={matchData.matchStats.rounds}
                    players={matchData.matchStats.players}
                    teams={matchData.teams}
                    onClose={() => setShowAnalysis(false)}
                />
            )}
        </div>
    );
}

export default App;