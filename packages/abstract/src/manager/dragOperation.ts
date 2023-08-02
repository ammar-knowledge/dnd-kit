import {Position, type Shape} from '@dnd-kit/geometry';
import type {Coordinates} from '@dnd-kit/geometry';
import type {UniqueIdentifier} from '@dnd-kit/types';
import {batch, computed, signal} from '@dnd-kit/state';

import type {Draggable, Droppable} from '../nodes';

import type {DragDropManager} from './manager';

export enum Status {
  Idle = 'idle',
  Initializing = 'initializing',
  Dragging = 'dragging',
  Dropping = 'dropped',
}

export type Serializable = {
  [key: string]: string | number | null | Serializable | Serializable[];
};

export interface DragOperation<
  T extends Draggable = Draggable,
  U extends Droppable = Droppable,
> {
  status: Status;
  position: Position;
  transform: Coordinates;
  initialized: boolean;
  shape: Shape | null;
  source: T | null;
  target: U | null;
  data?: Serializable;
}

export type DragActions<
  T extends Draggable,
  U extends Droppable,
  V extends DragDropManager<T, U>,
> = ReturnType<typeof DragOperationManager<T, U, V>>['actions'];

export function DragOperationManager<
  T extends Draggable,
  U extends Droppable,
  V extends DragDropManager<T, U>,
>(manager: V) {
  const {
    registry: {draggable, droppable},
    monitor,
    modifiers,
  } = manager;
  const status = signal<Status>(Status.Idle);
  const shape = signal<Shape | null>(null);
  const position = new Position({x: 0, y: 0});
  const sourceIdentifier = signal<UniqueIdentifier | null>(null);
  const targetIdentifier = signal<UniqueIdentifier | null>(null);
  const source = computed(() => {
    const identifier = sourceIdentifier.value;
    return identifier ? draggable.get(identifier) : null;
  });
  const target = computed(() => {
    const identifier = targetIdentifier.value;
    return identifier ? droppable.get(identifier) : null;
  });
  const dragging = computed(() => status.value === Status.Dragging);

  const transform = computed(() => {
    const {x, y} = position.delta;
    let transform = {x, y};
    const operation = {
      source: source.peek() ?? null,
      target: target.peek() ?? null,
      initialized: status.peek() !== Status.Idle,
      status: status.peek(),
      shape: shape.peek(),
      position,
    };

    for (const modifier of modifiers) {
      transform = modifier.apply({...operation, transform});
    }

    return transform;
  });

  const operation: DragOperation<T, U> = {
    get source() {
      return source.value ?? null;
    },
    get target() {
      return target.value ?? null;
    },
    get status() {
      return status.value;
    },
    get initialized() {
      return status.value !== Status.Idle;
    },
    get shape() {
      return shape.value;
    },
    set shape(value: Shape | null) {
      if (value && shape.peek()?.equals(value)) {
        return;
      }

      shape.value = value;
    },
    get transform() {
      return transform.value;
    },
    position,
  };

  return {
    operation,
    actions: {
      setDragSource(identifier: UniqueIdentifier) {
        sourceIdentifier.value = identifier;
      },
      setDropTarget(identifier: UniqueIdentifier | null) {
        if (!dragging.peek()) {
          return;
        }

        targetIdentifier.value = identifier;

        monitor.dispatch('dragover', {
          operation: snapshot(operation),
        });
      },
      start(coordinates: Coordinates) {
        status.value = Status.Initializing;

        batch(() => {
          status.value = Status.Dragging;
          position.reset(coordinates);
        });

        monitor.dispatch('dragstart', {});
      },
      move(coordinates: Coordinates) {
        if (!dragging.peek()) {
          return;
        }

        position.update(coordinates);

        monitor.dispatch('dragmove', {});
      },
      cancel() {
        // TO-DO
        monitor.dispatch('dragend', {
          operation: snapshot(operation),
          canceled: true,
        });
      },
      stop() {
        status.value = Status.Dropping;

        monitor.dispatch('dragend', {
          operation: snapshot(operation),
          canceled: false,
        });

        requestAnimationFrame(() => {
          batch(() => {
            status.value = Status.Idle;
            sourceIdentifier.value = null;
            targetIdentifier.value = null;
            shape.value = null;
            position.reset({x: 0, y: 0});
          });
        });
      },
    },
  };
}

function snapshot<T extends Record<string, any>>(obj: T): T {
  return {
    ...obj,
  };
}
