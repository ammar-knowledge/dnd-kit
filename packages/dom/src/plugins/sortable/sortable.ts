import type {
  Data,
  DragDropManager as AbstractDragDropManager,
} from '@dnd-kit/abstract';
import {effect, reactive, untracked} from '@dnd-kit/state';
import type {Type, UniqueIdentifier} from '@dnd-kit/types';

import {Draggable, Droppable} from '../../nodes';
import type {
  DraggableInput,
  DraggableFeedback,
  DroppableInput,
} from '../../nodes';
import type {Sensors} from '../../sensors';
import {DOMRectangle} from '../../shapes';

export interface SortableInput<T extends Data>
  extends DraggableInput<T>,
    DroppableInput<T> {
  index: number;
}

export class Sortable<T extends Data = Data> {
  protected draggable: Draggable<T>;
  protected droppable: Droppable<T>;

  @reactive
  index: number;

  constructor(
    {index, ...input}: SortableInput<T>,
    protected manager: AbstractDragDropManager<any, any>
  ) {
    this.draggable = new Draggable(input, manager);
    this.droppable = new Droppable({...input, ignoreTransform: true}, manager);

    let previousIndex = index;

    this.index = index;

    const {destroy} = this;

    const animate = () => {
      const {shape, element} = this.droppable;

      if (!shape || !element) {
        return;
      }

      this.droppable.updateShape();
      const updatedShape = this.droppable.shape;

      if (!updatedShape) {
        return;
      }

      const delta = {
        x: shape.boundingRectangle.left - updatedShape.boundingRectangle.left,
        y: shape.boundingRectangle.top - updatedShape.boundingRectangle.top,
      };

      if (delta.x || delta.y) {
        element.animate(
          {
            transform: [
              `translate3d(${delta.x}px, ${delta.y}px, 0)`,
              'translate3d(0, 0, 0)',
            ],
          },
          {duration: 150, easing: 'ease'}
        );
      }
    };

    const effectCleanup = effect(() => {
      const {index} = this;

      // Re-run this effect whenever the index changes
      if (index === previousIndex) {
        return;
      }

      previousIndex = index;

      untracked(animate);
    });

    this.destroy = () => {
      destroy.bind(this)();
      effectCleanup();
    };
  }

  public get disabled() {
    return this.draggable.disabled && this.droppable.disabled;
  }

  public set feedback(value: DraggableFeedback) {
    this.draggable.feedback = value;
  }

  public set disabled(value: boolean) {
    this.draggable.disabled = value;
    this.droppable.disabled = value;
  }

  public set activator(activator: Element | undefined) {
    this.draggable.activator = activator;
  }

  public set element(element: Element | undefined) {
    this.draggable.element = element;
    this.droppable.element = element;
  }

  public set id(id: UniqueIdentifier) {
    this.draggable.id = id;
    this.droppable.id = id;
  }

  public set sensors(value: Sensors | undefined) {
    this.draggable.sensors = value;
  }

  public set type(type: Type | undefined) {
    this.draggable.type = type;
  }

  public set accept(value: Type[] | undefined) {
    this.droppable.accept = value;
  }

  public get isDropTarget() {
    return this.droppable.isDropTarget;
  }

  public get isDragSource() {
    return this.draggable.isDragSource;
  }

  public accepts(types: Type | Type[]) {
    return this.droppable.accepts(types);
  }

  public destroy() {
    this.draggable.destroy();
    this.droppable.destroy();
  }
}

function noop() {}
