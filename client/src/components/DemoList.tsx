import React from 'react';
import clsx from 'clsx';
import { DemoUpload } from './DemoUpload';
import { deleteDemo } from '../api';

interface Demo {
    name: string;
    size: number;
    created: string;
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

    return (
        <div className="bg-cs2-panel p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-cs2-accent">Available Demos</h2>
            <ul className="space-y-2">
                {demos.map((demo) => (
                    <li
                        key={demo.name}
                        onClick={() => onSelect(demo.name)}
                        className={clsx(
                            "p-3 rounded transition-colors flex justify-between items-center cursor-pointer",
                            selectedDemo === demo.name
                                ? "bg-cs2-accent text-black font-bold"
                                : "bg-opacity-20 bg-black hover:bg-opacity-40 text-cs2-text"
                        )}
                    >
                        <span className="font-mono truncate">{demo.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={clsx("text-sm", selectedDemo === demo.name ? "text-black/70" : "text-gray-500")}>
                                {(demo.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                            {isAdmin && (
                                <button
                                    onClick={(e) => handleDelete(e, demo.name)}
                                    className={clsx(
                                        "text-xs px-1.5 py-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors",
                                        selectedDemo === demo.name ? "text-black/50" : "text-gray-600"
                                    )}
                                    title="Delete demo"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            {isAdmin && <DemoUpload onUploadComplete={onRefresh} adminPassword={adminPassword} />}
        </div>
    );
};
