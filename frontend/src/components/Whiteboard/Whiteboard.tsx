import { Stage, Layer, Line } from 'react-konva';
import { useRef, useState, useEffect } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import Toolbar from '../Toolbar';
import './Whiteboard.css';

const GRID_SIZE = 40; // px between grid lines
const GRID_COLOR = '#e0e0e0';
const STROKE_TENSION = 0.4; // bezier curve smoothing (0 = sharp, 1 = very smooth)
const MIN_POINT_DISTANCE = 3; // skip points closer than this to reduce jitter
const DEFAULT_BRUSH_SIZE = 3;
const DEFAULT_STROKE_COLOR = '#000000';
const DEFAULT_ERASER_SIZE = 20; // default partial eraser size

// Tool types for the whiteboard
type ToolType = 'pen' | 'eraser';
type EraserMode = 'partial' | 'stroke';

interface StrokeLine {
  id: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

interface GridProps {
  width: number;
  height: number;
}

function Grid({ width, height }: GridProps) {
  const lines = [];

  for (let x = 0; x <= width; x += GRID_SIZE) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke={GRID_COLOR}
        strokeWidth={1}
      />
    );
  }

  for (let y = 0; y <= height; y += GRID_SIZE) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke={GRID_COLOR}
        strokeWidth={1}
      />
    );
  }

  return <>{lines}</>;
}

// Hit testing: find stroke ID at given position
function findStrokeAtPosition(
  x: number,
  y: number,
  strokes: StrokeLine[],
  hitRadius: number
): string | null {
  // Check strokes in reverse order (top-most first)
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    const points = stroke.points;

    // Check each line segment in the stroke
    for (let j = 0; j < points.length - 2; j += 2) {
      const x1 = points[j];
      const y1 = points[j + 1];
      const x2 = points[j + 2];
      const y2 = points[j + 3];

      // Calculate distance from point to line segment
      const dist = pointToSegmentDistance(x, y, x1, y1, x2, y2);

      // Include stroke width in hit detection
      const threshold = hitRadius + stroke.strokeWidth / 2;
      if (dist <= threshold) {
        return stroke.id;
      }
    }
  }
  return null;
}

// Calculate distance from point (px, py) to line segment (x1,y1)-(x2,y2)
function pointToSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  // Project point onto line, clamped to segment
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

// Partial eraser: remove points near cursor and split strokes if needed
function eraseAtPosition(
  x: number,
  y: number,
  strokes: StrokeLine[],
  eraserRadius: number
): StrokeLine[] {
  const result: StrokeLine[] = [];

  for (const stroke of strokes) {
    const points = stroke.points;
    let currentSegment: number[] = [];
    let segmentCount = 0;

    // Check each point in the stroke
    for (let i = 0; i < points.length; i += 2) {
      const px = points[i];
      const py = points[i + 1];
      const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);

      if (dist > eraserRadius) {
        // Point is outside eraser radius, keep it
        currentSegment.push(px, py);
      } else {
        // Point is inside eraser radius, save current segment and start new one
        if (currentSegment.length >= 4) {
          result.push({
            ...stroke,
            id: `${stroke.id}-${segmentCount++}`,
            points: [...currentSegment],
          });
        }
        currentSegment = [];
      }
    }

    // Save remaining segment
    if (currentSegment.length >= 4) {
      result.push({
        ...stroke,
        id: segmentCount > 0 ? `${stroke.id}-${segmentCount}` : stroke.id,
        points: currentSegment,
      });
    }
  }

  return result;
}

export default function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const [lines, setLines] = useState<StrokeLine[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Drawing context - stores current tool settings
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR); // hex code
  const [activeTool, setActiveTool] = useState<ToolType>('pen');

  // Eraser settings
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [eraserSize, setEraserSize] = useState(DEFAULT_ERASER_SIZE);

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle pointer down - start drawing or erasing
  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (activeTool === 'eraser') {
      if (eraserMode === 'stroke') {
        // Stroke mode: delete entire stroke under cursor
        const hitId = findStrokeAtPosition(pos.x, pos.y, lines, eraserSize / 2);
        if (hitId) {
          setLines(lines.filter((line) => line.id !== hitId));
        }
      } else {
        // Partial mode: erase parts of strokes
        setLines(eraseAtPosition(pos.x, pos.y, lines, eraserSize));
      }
    } else {
      // Start a new stroke with current tool settings
      setIsDrawing(true);
      setLines([
        ...lines,
        {
          id: `stroke-${Date.now()}`,
          points: [pos.x, pos.y],
          color: strokeColor, // Apply selected color to new stroke
          strokeWidth: brushSize,
        },
      ]);
    }
  };

  // Handle pointer move - continue drawing or erasing
  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    if (activeTool === 'eraser' && e.evt.buttons === 1) {
      // Erase while dragging (mouse button held)
      if (eraserMode === 'stroke') {
        const hitId = findStrokeAtPosition(pos.x, pos.y, lines, eraserSize / 2);
        if (hitId) {
          setLines((prev) => prev.filter((line) => line.id !== hitId));
        }
      } else {
        setLines((prev) => eraseAtPosition(pos.x, pos.y, prev, eraserSize));
      }
      return;
    }

    if (!isDrawing) return;

    setLines((prevLines) => {
      const lastLine = prevLines[prevLines.length - 1];
      if (!lastLine) return prevLines;

      const points = lastLine.points;
      const lastX = points[points.length - 2];
      const lastY = points[points.length - 1];

      // Distance check for point simplification
      const dx = pos.x - lastX;
      const dy = pos.y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MIN_POINT_DISTANCE) return prevLines;

      const updatedLine = {
        ...lastLine,
        points: [...points, pos.x, pos.y],
      };

      return [...prevLines.slice(0, -1), updatedLine];
    });
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  return (
    <div className="whiteboard-container" ref={containerRef}>
      <Toolbar
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        strokeColor={strokeColor}
        onColorChange={setStrokeColor}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        eraserMode={eraserMode}
        onEraserModeChange={setEraserMode}
        eraserSize={eraserSize}
        onEraserSizeChange={setEraserSize}
      />
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ cursor: activeTool === 'eraser' ? 'crosshair' : 'default' }}
      >
        <Layer>
          <Grid width={dimensions.width} height={dimensions.height} />
        </Layer>
        {/* Render strokes with their stored color */}
        <Layer>
          {lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={line.color} // Each stroke uses its own color
              strokeWidth={line.strokeWidth}
              lineCap="round"
              lineJoin="round"
              tension={STROKE_TENSION}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

