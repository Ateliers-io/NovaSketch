import React, { useMemo } from 'react';
import {
    Shape,
    RectangleShape,
    CircleShape,
    EllipseShape,
    LineShape,
    ArrowShape,
    TriangleShape,
    isRectangle,
    isCircle,
    isEllipse,
    isLine,
    isArrow,
    isTriangle,
} from '../../types/shapes';
import './SVGShapeRenderer.css';

// --- PROPS ---
interface SVGShapeRendererProps {
    shapes: Shape[];
    width: number;
    height: number;
    // Changed to onPointerDown to support immediate Dragging
    onShapePointerDown?: (shape: Shape, e: React.PointerEvent) => void;
    selectedShapeId?: string | null;
}

// --- CONSTANTS ---
const NEON_TURQUOISE = '#66FCF1';

// --- HELPER COMPONENTS ---

/**
 * HUD Selection Reticle
 * Renders a "Tech" style bounding box + ID Label
 */
const SelectionReticle: React.FC<{ width: number; height: number; shapeId: string }> = ({ width, height, shapeId }) => {
    const p = 6; // Padding
    const l = 12; // Corner length
    const x = -width / 2 - p;
    const y = -height / 2 - p;
    const w = width + p * 2;
    const h = height + p * 2;

    return (
        <g className="selection-reticle">
            {/* Dashed Bounding Box */}
            <rect x={x} y={y} width={w} height={h} className="reticle-box" />
            
            {/* Tech Corners */}
            <path d={`M ${x} ${y + l} V ${y} H ${x + l}`} className="reticle-corner" /> 
            <path d={`M ${x + w - l} ${y} H ${x + w} V ${y + l}`} className="reticle-corner" /> 
            <path d={`M ${x + w} ${y + h - l} V ${y + h} H ${x + w - l}`} className="reticle-corner" /> 
            <path d={`M ${x + l} ${y + h} H ${x} V ${y + h - l}`} className="reticle-corner" />

            {/* ID Tag (CAD Style) */}
            <g transform={`translate(${x}, ${y - 12})`}>
                <rect x="0" y="0" width="60" height="10" fill={NEON_TURQUOISE} opacity="0.1" />
                <text x="4" y="8" fontSize="8" fontFamily="monospace" fill={NEON_TURQUOISE} fontWeight="bold">
                    ID: {shapeId.slice(-4).toUpperCase()}
                </text>
            </g>
        </g>
    );
};

/**
 * Shape Wrapper
 * Handles Transforms, Events (PointerDown), and the Selection Overlay centrally.
 */
interface ShapeWrapperProps {
    shape: Shape;
    isSelected: boolean;
    onPointerDown?: (shape: Shape, e: React.PointerEvent) => void;
    children: React.ReactNode;
    dimensions: { width: number; height: number };
    centerOffset: { x: number; y: number };
}

const ShapeWrapper: React.FC<ShapeWrapperProps> = ({ shape, isSelected, onPointerDown, children, dimensions, centerOffset }) => {
    const { position, transform, opacity } = shape;
    
    const centerX = position.x + centerOffset.x;
    const centerY = position.y + centerOffset.y;

    return (
        <g
            transform={`translate(${centerX}, ${centerY}) rotate(${transform.rotation}) scale(${transform.scaleX}, ${transform.scaleY})`}
            opacity={opacity}
            onPointerDown={(e) => {
                // STOP PROPAGATION is critical for Drag & Drop
                // It prevents the Whiteboard background from detecting a click and starting a new pen line
                e.stopPropagation();
                onPointerDown?.(shape, e);
            }}
            className={`svg-shape-group ${isSelected ? 'selected' : ''}`}
            data-tech-id={shape.id}
        >
            <g transform={`translate(${-centerOffset.x}, ${-centerOffset.y})`}>
                {children}
            </g>

            {isSelected && (
                 <SelectionReticle width={dimensions.width} height={dimensions.height} shapeId={shape.id} />
            )}
        </g>
    );
};

// --- PRIMITIVE SHAPES ---

// Helper type for the shape components
interface SpecificShapeProps<T extends Shape> {
    shape: T;
    isSelected: boolean;
    onPointerDown?: (s: Shape, e: React.PointerEvent) => void;
}

const SVGRectangle = ({ shape, isSelected, onPointerDown }: SpecificShapeProps<RectangleShape>) => (
    <ShapeWrapper
        shape={shape}
        isSelected={isSelected}
        onPointerDown={onPointerDown}
        dimensions={{ width: shape.width, height: shape.height }}
        centerOffset={{ x: shape.width / 2, y: shape.height / 2 }}
    >
        <rect
            width={shape.width}
            height={shape.height}
            rx={shape.cornerRadius || 0}
            fill={isSelected && shape.style.hasFill ? "url(#tech-grid)" : (shape.style.hasFill ? shape.style.fill : 'none')}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGCircle = ({ shape, isSelected, onPointerDown }: SpecificShapeProps<CircleShape>) => (
    <ShapeWrapper
        shape={shape}
        isSelected={isSelected}
        onPointerDown={onPointerDown}
        dimensions={{ width: shape.radius * 2, height: shape.radius * 2 }}
        centerOffset={{ x: 0, y: 0 }}
    >
        <circle
            cx={0} cy={0}
            r={shape.radius}
            fill={isSelected && shape.style.hasFill ? "url(#tech-grid)" : (shape.style.hasFill ? shape.style.fill : 'none')}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGEllipse = ({ shape, isSelected, onPointerDown }: SpecificShapeProps<EllipseShape>) => (
    <ShapeWrapper
        shape={shape}
        isSelected={isSelected}
        onPointerDown={onPointerDown}
        dimensions={{ width: shape.radiusX * 2, height: shape.radiusY * 2 }}
        centerOffset={{ x: 0, y: 0 }}
    >
        <ellipse
            cx={0} cy={0}
            rx={shape.radiusX}
            ry={shape.radiusY}
            fill={isSelected && shape.style.hasFill ? "url(#tech-grid)" : (shape.style.hasFill ? shape.style.fill : 'none')}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            className="svg-primitive"
        />
    </ShapeWrapper>
);

const SVGLine = ({ shape, isSelected, onPointerDown }: SpecificShapeProps<LineShape>) => {
    const dx = shape.endPoint.x - shape.startPoint.x;
    const dy = shape.endPoint.y - shape.startPoint.y;
    const midX = shape.startPoint.x + dx / 2;
    const midY = shape.startPoint.y + dy / 2;

    return (
        <g
            transform={`translate(${midX}, ${midY}) rotate(${shape.transform.rotation})`}
            opacity={shape.opacity}
            onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(shape, e); }}
            className={`svg-shape-group ${isSelected ? 'selected' : ''}`}
        >
            <line
                x1={-dx/2} y1={-dy/2}
                x2={dx/2} y2={dy/2}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeLinecap="round"
                className="svg-primitive"
            />
            {isSelected && <SelectionReticle width={Math.abs(dx)} height={Math.abs(dy)} shapeId={shape.id} />}
        </g>
    );
};

const SVGArrow = ({ shape, isSelected, onPointerDown }: SpecificShapeProps<ArrowShape>) => {
    const dx = shape.endPoint.x - shape.startPoint.x;
    const dy = shape.endPoint.y - shape.startPoint.y;
    const midX = shape.startPoint.x + dx / 2;
    const midY = shape.startPoint.y + dy / 2;

    return (
        <g
            transform={`translate(${midX}, ${midY}) rotate(${shape.transform.rotation})`}
            opacity={shape.opacity}
            onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(shape, e); }}
            className={`svg-shape-group ${isSelected ? 'selected' : ''}`}
        >
            <line
                x1={-dx/2} y1={-dy/2}
                x2={dx/2} y2={dy/2}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                strokeLinecap="round"
                markerEnd="url(#arrowhead)"
                className="svg-primitive"
            />
            {isSelected && <SelectionReticle width={Math.abs(dx)} height={Math.abs(dy)} shapeId={shape.id} />}
        </g>
    );
};

const SVGTriangle = ({ shape, isSelected, onPointerDown }: SpecificShapeProps<TriangleShape>) => {
    const cx = (shape.points[0].x + shape.points[1].x + shape.points[2].x) / 3;
    const cy = (shape.points[0].y + shape.points[1].y + shape.points[2].y) / 3;
    
    const xs = shape.points.map(p => p.x);
    const ys = shape.points.map(p => p.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    const relPoints = shape.points.map(p => `${p.x - cx},${p.y - cy}`).join(' ');

    return (
        <g
            transform={`translate(${cx}, ${cy}) rotate(${shape.transform.rotation}) scale(${shape.transform.scaleX}, ${shape.transform.scaleY})`}
            opacity={shape.opacity}
            onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(shape, e); }}
            className={`svg-shape-group ${isSelected ? 'selected' : ''}`}
        >
            <polygon
                points={relPoints}
                fill={isSelected && shape.style.hasFill ? "url(#tech-grid)" : (shape.style.hasFill ? shape.style.fill : 'none')}
                stroke={shape.style.stroke}
                strokeWidth={shape.style.strokeWidth}
                className="svg-primitive"
            />
            {isSelected && <SelectionReticle width={width} height={height} shapeId={shape.id} />}
        </g>
    );
};

// --- MAIN RENDERER ---

export const SVGShapeRenderer: React.FC<SVGShapeRendererProps> = ({
    shapes,
    width,
    height,
    onShapePointerDown,
    selectedShapeId,
}) => {
    const sortedShapes = useMemo(() => 
        [...shapes].sort((a, b) => a.zIndex - b.zIndex), 
    [shapes]);

    return (
        <svg
            className="svg-renderer-layer"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <filter id="neon-bloom" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                    <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.4 0 0 0 0 0.99 0 0 0 0 0.95 0 0 0 0.5 0" />
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <pattern id="tech-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                    <path d="M 8 0 L 0 0 0 8" fill="none" stroke={NEON_TURQUOISE} strokeWidth="0.5" opacity="0.3"/>
                    <rect width="8" height="8" fill={NEON_TURQUOISE} opacity="0.1" />
                </pattern>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={NEON_TURQUOISE} />
                </marker>
            </defs>

            {sortedShapes
                .filter((shape) => shape.visible)
                .map((shape) => {
                    const isSelected = selectedShapeId === shape.id;
                    
                    // FIXED: Common props object WITHOUT the key
                    const commonProps = { 
                        isSelected, 
                        onPointerDown: onShapePointerDown 
                    };

                    // FIXED: Key is passed explicitly to the Component
                    if (isRectangle(shape)) return <SVGRectangle key={shape.id} shape={shape} {...commonProps} />;
                    if (isCircle(shape)) return <SVGCircle key={shape.id} shape={shape} {...commonProps} />;
                    if (isEllipse(shape)) return <SVGEllipse key={shape.id} shape={shape} {...commonProps} />;
                    if (isLine(shape)) return <SVGLine key={shape.id} shape={shape} {...commonProps} />;
                    if (isArrow(shape)) return <SVGArrow key={shape.id} shape={shape} {...commonProps} />;
                    if (isTriangle(shape)) return <SVGTriangle key={shape.id} shape={shape} {...commonProps} />;
                    
                    return null;
                })}
        </svg>
    );
};

export default SVGShapeRenderer;