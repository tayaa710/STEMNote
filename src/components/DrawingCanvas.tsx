import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { v4 as uuidv4 } from 'uuid';
import { DrawingData, DrawingTool, Point, Stroke } from '../types/models';

const DRAWING_VERSION = 1;
const DEFAULT_COLOR = '#111111';
const DEFAULT_WIDTH = 3;
const MIN_POINT_DISTANCE = 2;
const MIN_POINT_DISTANCE_SQ = MIN_POINT_DISTANCE * MIN_POINT_DISTANCE;
const ERASER_TAP_SLOP = 12;
const ERASER_TAP_SLOP_SQ = ERASER_TAP_SLOP * ERASER_TAP_SLOP;
const ERASER_HIT_PADDING = 12;
const MAX_HISTORY = 20;

type HistoryStack = Stroke[][];

type DrawingState = {
  strokes: Stroke[];
  undoStack: HistoryStack;
  redoStack: HistoryStack;
};

type DrawingAction =
  | { type: 'set'; strokes: Stroke[] }
  | { type: 'add'; stroke: Stroke }
  | { type: 'erase'; strokeId: string }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'redo' };

function capHistory(stack: HistoryStack): HistoryStack {
  if (stack.length <= MAX_HISTORY) {
    return stack;
  }
  return stack.slice(stack.length - MAX_HISTORY);
}

function pushHistory(stack: HistoryStack, snapshot: Stroke[]): HistoryStack {
  return capHistory([...stack, snapshot]);
}

function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  switch (action.type) {
    case 'set':
      return {
        strokes: action.strokes,
        undoStack: [],
        redoStack: [],
      };
    case 'add':
      return {
        strokes: [...state.strokes, action.stroke],
        undoStack: pushHistory(state.undoStack, state.strokes),
        redoStack: [],
      };
    case 'erase': {
      const exists = state.strokes.some(stroke => stroke.id === action.strokeId);
      if (!exists) {
        return state;
      }
      return {
        strokes: state.strokes.filter(stroke => stroke.id !== action.strokeId),
        undoStack: pushHistory(state.undoStack, state.strokes),
        redoStack: [],
      };
    }
    case 'clear':
      if (state.strokes.length === 0) {
        return state;
      }
      return {
        strokes: [],
        undoStack: pushHistory(state.undoStack, state.strokes),
        redoStack: [],
      };
    case 'undo': {
      if (state.undoStack.length === 0) {
        return state;
      }
      const previous = state.undoStack[state.undoStack.length - 1];
      return {
        strokes: previous,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: pushHistory(state.redoStack, state.strokes),
      };
    }
    case 'redo': {
      if (state.redoStack.length === 0) {
        return state;
      }
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        strokes: next,
        undoStack: pushHistory(state.undoStack, state.strokes),
        redoStack: state.redoStack.slice(0, -1),
      };
    }
    default:
      return state;
  }
}

function distanceSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function distanceToSegmentSq(point: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = point.x - a.x;
  const wy = point.y - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) {
    return distanceSq(point, a);
  }
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) {
    return distanceSq(point, b);
  }
  const t = c1 / c2;
  const projection = { x: a.x + t * vx, y: a.y + t * vy };
  return distanceSq(point, projection);
}

function isPointNearStroke(point: Point, stroke: Stroke): boolean {
  const points = stroke.points;
  if (points.length === 0) {
    return false;
  }
  const tolerance = stroke.width / 2 + ERASER_HIT_PADDING;
  const toleranceSq = tolerance * tolerance;
  if (points.length === 1) {
    return distanceSq(point, points[0]) <= toleranceSq;
  }
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (distanceToSegmentSq(point, a, b) <= toleranceSq) {
      return true;
    }
  }
  return false;
}

function buildPath(points: Point[]) {
  const path = Skia.Path.Make();
  if (points.length === 0) {
    return path;
  }
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
}

export interface DrawingCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  getDrawingData: () => DrawingData;
}

interface DrawingCanvasProps {
  pageId: string;
  drawingData: DrawingData | null;
  activeTool: DrawingTool;
  onDrawingChange: (drawingData: DrawingData) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  isInteractive?: boolean;
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  (
    {
      pageId,
      drawingData,
      activeTool,
      onDrawingChange,
      onHistoryChange,
      isInteractive = true,
    },
    ref,
  ) => {
    const [state, dispatch] = useReducer(drawingReducer, {
      strokes: [],
      undoStack: [],
      redoStack: [],
    });

    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const currentPointsRef = useRef<Point[]>([]);
    const strokesRef = useRef<Stroke[]>(state.strokes);
    const activeToolRef = useRef<DrawingTool>(activeTool);
    const isDrawingRef = useRef(false);
    const isInteractiveRef = useRef(isInteractive);
    const suppressOnChangeRef = useRef(true);
    const eraserStartRef = useRef<Point | null>(null);
    const eraserMovedRef = useRef(false);

    const updateCurrentPoints = useCallback(
      (updater: Point[] | ((prev: Point[]) => Point[])) => {
        setCurrentPoints(prev => {
          const next = typeof updater === 'function' ? updater(prev) : updater;
          currentPointsRef.current = next;
          return next;
        });
      },
      [],
    );

    const cancelCurrentStroke = useCallback(() => {
      isDrawingRef.current = false;
      updateCurrentPoints([]);
    }, [updateCurrentPoints]);

    useEffect(() => {
      activeToolRef.current = activeTool;
      if (activeTool === 'eraser') {
        cancelCurrentStroke();
      }
    }, [activeTool, cancelCurrentStroke]);

    useEffect(() => {
      isInteractiveRef.current = isInteractive;
      if (!isInteractive) {
        cancelCurrentStroke();
      }
    }, [isInteractive, cancelCurrentStroke]);

    useEffect(() => {
      strokesRef.current = state.strokes;
    }, [state.strokes]);

    useEffect(() => {
      suppressOnChangeRef.current = true;
      dispatch({ type: 'set', strokes: drawingData?.strokes ?? [] });
      cancelCurrentStroke();
    }, [pageId, drawingData, cancelCurrentStroke]);

    useEffect(() => {
      if (suppressOnChangeRef.current) {
        suppressOnChangeRef.current = false;
        return;
      }
      onDrawingChange({ version: DRAWING_VERSION, strokes: state.strokes });
    }, [state.strokes, onDrawingChange]);

    useEffect(() => {
      onHistoryChange?.(state.undoStack.length > 0, state.redoStack.length > 0);
    }, [state.undoStack.length, state.redoStack.length, onHistoryChange]);

    useImperativeHandle(ref, () => ({
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      clear: () => dispatch({ type: 'clear' }),
      getDrawingData: () => ({ version: DRAWING_VERSION, strokes: state.strokes }),
    }));

    const handlePenStart = useCallback(
      (point: Point) => {
        isDrawingRef.current = true;
        updateCurrentPoints([point]);
      },
      [updateCurrentPoints],
    );

    const handlePenMove = useCallback(
      (point: Point) => {
        if (!isDrawingRef.current) {
          return;
        }
        const lastPoint =
          currentPointsRef.current[currentPointsRef.current.length - 1];
        if (!lastPoint || distanceSq(lastPoint, point) >= MIN_POINT_DISTANCE_SQ) {
          updateCurrentPoints(prev => [...prev, point]);
        }
      },
      [updateCurrentPoints],
    );

    const handlePenEnd = useCallback(() => {
      if (!isDrawingRef.current) {
        return;
      }
      const points = currentPointsRef.current;
      cancelCurrentStroke();
      if (points.length === 0) {
        return;
      }
      const stroke: Stroke = {
        id: uuidv4(),
        points,
        color: DEFAULT_COLOR,
        width: DEFAULT_WIDTH,
        tool: 'pen',
        timestamp: Date.now(),
      };
      dispatch({ type: 'add', stroke });
    }, [cancelCurrentStroke]);

    const handleEraserStart = useCallback((point: Point) => {
      eraserStartRef.current = point;
      eraserMovedRef.current = false;
    }, []);

    const handleEraserMove = useCallback((point: Point) => {
      const start = eraserStartRef.current;
      if (!start) {
        return;
      }
      if (distanceSq(start, point) > ERASER_TAP_SLOP_SQ) {
        eraserMovedRef.current = true;
      }
    }, []);

    const handleEraserEnd = useCallback((point: Point) => {
      const start = eraserStartRef.current;
      if (!start || eraserMovedRef.current) {
        return;
      }
      const strokes = strokesRef.current;
      for (let i = strokes.length - 1; i >= 0; i -= 1) {
        const stroke = strokes[i];
        if (isPointNearStroke(point, stroke)) {
          dispatch({ type: 'erase', strokeId: stroke.id });
          break;
        }
      }
    }, []);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => isInteractiveRef.current,
          onMoveShouldSetPanResponder: () => isInteractiveRef.current,
          onPanResponderGrant: event => {
            if (!isInteractiveRef.current) {
              return;
            }
            const point = {
              x: event.nativeEvent.locationX,
              y: event.nativeEvent.locationY,
            };
            if (activeToolRef.current === 'pen') {
              handlePenStart(point);
            } else {
              handleEraserStart(point);
            }
          },
          onPanResponderMove: event => {
            if (!isInteractiveRef.current) {
              return;
            }
            const point = {
              x: event.nativeEvent.locationX,
              y: event.nativeEvent.locationY,
            };
            if (activeToolRef.current === 'pen') {
              handlePenMove(point);
            } else {
              handleEraserMove(point);
            }
          },
          onPanResponderRelease: event => {
            if (!isInteractiveRef.current) {
              return;
            }
            const point = {
              x: event.nativeEvent.locationX,
              y: event.nativeEvent.locationY,
            };
            if (activeToolRef.current === 'pen') {
              handlePenEnd();
            } else {
              handleEraserEnd(point);
            }
          },
          onPanResponderTerminate: () => {
            cancelCurrentStroke();
          },
        }),
      [
        handlePenStart,
        handlePenMove,
        handlePenEnd,
        handleEraserStart,
        handleEraserMove,
        handleEraserEnd,
        cancelCurrentStroke,
      ],
    );

    const strokePaths = useMemo(
      () =>
        state.strokes.map(stroke => ({
          id: stroke.id,
          path: buildPath(stroke.points),
          color: stroke.color,
          width: stroke.width,
        })),
      [state.strokes],
    );

    const currentPath = useMemo(
      () => buildPath(currentPoints),
      [currentPoints],
    );

    return (
      <View style={styles.container} {...panResponder.panHandlers}>
        <Canvas style={styles.canvas}>
          {strokePaths.map(stroke => (
            <Path
              key={stroke.id}
              path={stroke.path}
              color={stroke.color}
              style="stroke"
              strokeWidth={stroke.width}
              strokeJoin="round"
              strokeCap="round"
            />
          ))}
          {activeTool === 'pen' && currentPoints.length > 0 ? (
            <Path
              path={currentPath}
              color={DEFAULT_COLOR}
              style="stroke"
              strokeWidth={DEFAULT_WIDTH}
              strokeJoin="round"
              strokeCap="round"
            />
          ) : null}
        </Canvas>
      </View>
    );
  },
);

DrawingCanvas.displayName = 'DrawingCanvas';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  canvas: {
    flex: 1,
  },
});

export default DrawingCanvas;
