import { Stage, Layer, Line, Circle } from 'react-konva';
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
    let currentLinePoints: number[] = [];
    let segmentCount = 0;

    // Helper to finish current line and start a new one
    const finishLine = () => {
      if (currentLinePoints.length >= 4) {
        result.push({
          ...stroke,
          id: `${stroke.id}-${segmentCount++}`,
          points: [...currentLinePoints],
        });
      }
      currentLinePoints = [];
    };

    if (points.length < 4) {
      // Keep tiny lines intact if they are far away (simplification)
      // Or check center point.
      result.push(stroke);
      continue;
    }

    // Start with the first point
    let px = points[0];
    let py = points[1];

    // Check if start point is outside
    if (!isPointInCircle(px, py, x, y, eraserRadius)) {
      currentLinePoints.push(px, py);
    }

    // Iterate through all subsequent points form segments
    for (let i = 2; i < points.length; i += 2) {
      const cx = points[i];
      const cy = points[i + 1];

      const p1 = { x: px, y: py };
      const p2 = { x: cx, y: cy };

      // Calculate intersections between segment p1-p2 and circle
      const intersections = getSegmentCircleIntersections(p1, p2, { x, y }, eraserRadius);

      if (intersections.length === 0) {
        // No intersection. 
        if (!isPointInCircle(cx, cy, x, y, eraserRadius)) {
          // p2 is outside. And no intersection means p1 was outside too (or path didn't cross).
          currentLinePoints.push(cx, cy);
        } else {
          // p2 is inside. p1 must have been inside too (or close enough).
          finishLine();
        }
      } else {
        // We have intersections!
        // Sort intersections by distance from p1 to handle order correctly
        intersections.sort((a, b) => distSq(p1, a) - distSq(p1, b));

        for (const intersect of intersections) {
          if (currentLinePoints.length > 0) {
            // We are entering the circle (Eraser) -> Cut here
            currentLinePoints.push(intersect.x, intersect.y);
            finishLine();
          } else {
            // We are exiting the circle -> Start new line here
            currentLinePoints.push(intersect.x, intersect.y);
          }
        }

        // Finally handle the end point p2
        if (!isPointInCircle(cx, cy, x, y, eraserRadius)) {
          currentLinePoints.push(cx, cy);
        }
      }

      // Update prev point
      px = cx;
      py = cy;
    }

    finishLine();
  }

  return result;
}

function distSq(p1: { x: number, y: number }, p2: { x: number, y: number }) {
  return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

// Math helper: Find intersection of line segment p1-p2 and circle (center c, radius r)
function getSegmentCircleIntersections(p1: { x: number, y: number }, p2: { x: number, y: number }, c: { x: number, y: number }, r: number) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const fx = p1.x - c.x;
  const fy = p1.y - c.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const C = (fx * fx + fy * fy) - r * r;

  let discriminant = b * b - 4 * a * C;

  const intersections = [];

  if (discriminant >= 0) {
    // Handle floating point precision safely
    if (a === 0) return []; // Segment is a point

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 >= 0 && t1 <= 1) {
      intersections.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
    }
    if (t2 >= 0 && t2 <= 1) {
      intersections.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
    }
  }

  return intersections;
}

function isPointInCircle(px: number, py: number, cx: number, cy: number, r: number) {
  return (px - cx) ** 2 + (py - cy) ** 2 < r ** 2;
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

  // Cursor tracking for custom eraser cursor
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

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
        // Stroke Eraser: Completely delete specific objects
        // 1. Identify stroke under cursor using hit testing
        // 2. Filter it out of the state array to remove it
        const hitId = findStrokeAtPosition(pos.x, pos.y, lines, eraserSize / 2);
        if (hitId) {
          setLines(lines.filter((line) => line.id !== hitId));
        }
      } else {
        // Partial mode: erase parts of strokes
        setLines(eraseAtPosition(pos.x, pos.y, lines, eraserSize / 2));
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

    // Track cursor for custom eraser URL
    if (activeTool === 'eraser') {
      setCursorPos(pos);
    } else {
      setCursorPos(null);
    }

    if (activeTool === 'eraser' && e.evt.buttons === 1) {
      // Erase while dragging (mouse button held)
      if (eraserMode === 'stroke') {
        const hitId = findStrokeAtPosition(pos.x, pos.y, lines, eraserSize / 2);
        if (hitId) {
          setLines((prev) => prev.filter((line) => line.id !== hitId));
        }
      } else {
        setLines((prev) => eraseAtPosition(pos.x, pos.y, prev, eraserSize / 2));
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
        onPointerLeave={() => {
          handlePointerUp();
          setCursorPos(null);
        }}
        style={{ cursor: activeTool === 'eraser' ? 'none' : 'default' }} // Hide default cursor for eraser
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
          {/* Custom Eraser Cursor - circle indicator */}
          {activeTool === 'eraser' && cursorPos && (
            <Circle
              x={cursorPos.x}
              y={cursorPos.y}
              radius={eraserSize / 2}
              stroke="#333"
              strokeWidth={1}
              fill="rgba(255, 255, 255, 0.3)"
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}

