import { useState } from 'react';
import './Toolbar.css';

// Tool types for the whiteboard
type ToolType = 'pen' | 'eraser';
type EraserMode = 'partial' | 'stroke';

interface ToolbarProps {
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    strokeColor: string;
    onColorChange: (color: string) => void;
    activeTool: ToolType;
    onToolChange: (tool: ToolType) => void;
    eraserMode: EraserMode;
    onEraserModeChange: (mode: EraserMode) => void;
    eraserSize: number;
    onEraserSizeChange: (size: number) => void;
}

// Floating toolbar for drawing controls
export default function Toolbar({
    brushSize,
    onBrushSizeChange,
    strokeColor,
    onColorChange,
    activeTool,
    onToolChange,
    eraserMode,
    onEraserModeChange,
    eraserSize,
    onEraserSizeChange,
}: ToolbarProps) {
    const [showEraserMenu, setShowEraserMenu] = useState(false);

    return (
        <div className="toolbar">
            {/* Tool selection - pen or eraser */}
            <div className="toolbar-group">
                <button
                    className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`}
                    onClick={() => onToolChange('pen')}
                    title="Pen tool"
                >
                    ✏️
                </button>

                {/* Eraser with dropdown */}
                <div className="eraser-wrapper">
                    <button
                        className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
                        onClick={() => {
                            onToolChange('eraser');
                            setShowEraserMenu(!showEraserMenu);
                        }}
                        title="Eraser tool"
                    >
                        🧽
                    </button>

                    {/* Eraser options dropdown */}
                    {showEraserMenu && activeTool === 'eraser' && (
                        <div className="eraser-dropdown">
                            {/* Eraser mode selection */}
                            <div className="eraser-modes">
                                <button
                                    className={`eraser-mode-btn ${eraserMode === 'partial' ? 'active' : ''}`}
                                    onClick={() => {
                                        onEraserModeChange('partial');
                                        setShowEraserMenu(false); // Close dropdown after selection
                                    }}
                                    title="Partial eraser - erase parts of strokes"
                                >
                                    ✂️ Partial
                                </button>
                                <button
                                    className={`eraser-mode-btn ${eraserMode === 'stroke' ? 'active' : ''}`}
                                    onClick={() => {
                                        onEraserModeChange('stroke');
                                        setShowEraserMenu(false); // Close dropdown after selection
                                    }}
                                    title="Stroke eraser - delete entire stroke"
                                >
                                    🗑️ Stroke
                                </button>
                            </div>

                            {/* Eraser size slider (only for partial mode) */}
                            {eraserMode === 'partial' && (
                                <div className="eraser-size">
                                    <label>Size</label>
                                    <input
                                        type="range"
                                        min={5}
                                        max={50}
                                        value={eraserSize}
                                        onChange={(e) => onEraserSizeChange(Number(e.target.value))}
                                    />
                                    <span>{eraserSize}px</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Color picker - only show for pen tool */}
            {activeTool === 'pen' && (
                <div className="toolbar-group">
                    <label>Color</label>
                    <div className="color-input-wrapper">
                        <input
                            type="color"
                            value={strokeColor}
                            onChange={(e) => onColorChange(e.target.value)}
                            className="color-input"
                        />
                        <div
                            className="color-circle"
                            style={{ backgroundColor: strokeColor }}
                        />
                    </div>
                </div>
            )}

            {/* Brush size control - only show for pen tool */}
            {activeTool === 'pen' && (
                <div className="toolbar-group">
                    <label htmlFor="brush-size">Brush</label>
                    <input
                        id="brush-size"
                        type="range"
                        min={1}
                        max={20}
                        value={brushSize}
                        onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                    />
                    <span className="brush-size-value">{brushSize}px</span>
                </div>
            )}
        </div>
    );
}



