/**
 * @module index
 * @license MIT
 * @see https://reactjs.org/docs/context.html
 */

import * as React from 'react';
import { Callback, isFunction, generateStoreName, shallowEqual } from './utils';
import Repository, { StoreState, StoreUpdater, StoreWatcher, StoreSubscriber } from './store';

export declare type UserStore = {
  [key: string]: any;
  readonly state: StoreState;
  subscribe(fn: StoreSubscriber): void;
  unsubscribe(fn: StoreSubscriber): void;
  setState(updater: StoreUpdater, callback?: Callback): void;
};
export interface ContextState {
  store: UserStore;
  mounted: boolean;
}
export interface Store {
  readonly name: string;
  readonly data: ContextState;
  watch(fn: StoreWatcher): void;
  unwatch(fn: StoreWatcher): void;
  readonly context: React.Context<StoreState>;
}
export interface Props extends React.ClassAttributes<object> {
  [prop: string]: any;
  ref?: React.Ref<any>;
  forwardRef?: React.Ref<any>;
}
export interface ProviderDecorator {
  (Component: React.ComponentType<Props>): any;
}
export interface ConsumerDecorator {
  (Component: React.ComponentType<Props>): any;
}
export declare type Updaters = { [updater: string]: any };
export declare type MapStoreToProps = (store: UserStore, state: StoreState, props: Props) => Props;

// Variable definition
const { hasOwnProperty } = Object.prototype;
const defaultMapStoreToProps: MapStoreToProps = (store: UserStore) => ({ store });

/**
 * @function create
 * @param initialState
 * @param updater
 */
export function create(initialState: StoreState, updaters?: Updaters, name?: string): Store {
  // Create store
  const repository = new Repository(initialState);
  const store: UserStore = Object.defineProperties(Object.create(null), {
    state: { get: () => repository.state, enumerable: true },
    setState: { value: repository.setState.bind(repository), enumerable: true },
    subscribe: { value: repository.subscribe.bind(repository), enumerable: true },
    unsubscribe: { value: repository.unsubscribe.bind(repository), enumerable: true }
  });

  // Mixin updaters
  if (updaters) {
    for (const method in updaters) {
      // Use Object.prototype.hasOwnProperty fallback with Object create by Object.create(null)
      if (hasOwnProperty.call(updaters, method)) {
        const updater = updaters[method];

        // If is function binding context with store
        store[method] = isFunction(updater) ? updater.bind(store) : updater;
      }
    }
  }

  // Watcher
  const watch = repository.watch.bind(repository);
  const unwatch = repository.unwatch.bind(repository);
  const data: ContextState = { store, mounted: false };

  // Store
  return Object.defineProperties(Object.create(null), {
    data: { value: data },
    watch: { value: watch },
    unwatch: { value: unwatch },
    name: { value: name || generateStoreName(), enumerable: true },
    context: { value: React.createContext(data), enumerable: true }
  });
}

/**
 * @function mount
 * @param store
 * @param storeProp
 */
export function mount(
  store: Store,
  mapStoreToProps: MapStoreToProps = defaultMapStoreToProps,
  forwardRef: boolean = false
): ProviderDecorator {
  const { watch, unwatch, context, data } = store;

  /**
   * @function mount
   * @param Component
   */
  return function(Component: React.ComponentType<Props>) {
    /**
     * @class StoreProvider
     */
    class StoreProvider extends React.Component<Props> {
      /**
       * @property state
       */
      public readonly state: ContextState;

      /**
       * @method storeUpdater
       */
      private readonly storeUpdater: StoreWatcher = (updater: () => StoreState, callback: Callback) => {
        this.setState(updater, callback);
      };

      /**
       * @constructor
       * @param props
       * @param context
       */
      constructor(props: Props, context: React.Context<object>) {
        super(props, context);

        // Initialization state
        this.state = {
          mounted: true,
          store: data.store
        };

        // Subscribe store change
        watch(this.storeUpdater);
      }

      /**
       * @method componentWillUnmount
       */
      public componentWillUnmount() {
        // Unsubscribe store change
        unwatch(this.storeUpdater);
      }

      /**
       * @method shouldComponentUpdate
       * @param nextProps
       * @param nextState
       */
      public shouldComponentUpdate(nextProps: Props, nextState: ContextState) {
        const { store } = this.state;
        const { store: nextStore } = nextState;

        if (shallowEqual(this.props, nextProps) && shallowEqual(store.state, nextStore.store)) {
          return false;
        }

        return true;
      }

      /**
       * @method render
       */
      public render() {
        const data = this.state;
        const { store } = data;
        const { Provider } = context;
        const { forwardRef, ...rest } = this.props;
        const props = { ...rest, ...mapStoreToProps(store, store.state, this.props) };

        return (
          <Provider value={data}>
            <Component {...props} ref={forwardRef} />
          </Provider>
        );
      }
    }

    // Fallback forwardRef
    if (forwardRef) {
      return React.forwardRef((props: Props, ref: React.Ref<any>) => <StoreProvider {...props} forwardRef={ref} />);
    }

    // Return StoreProvider
    return StoreProvider;
  };
}

/**
 * @function connect
 * @param store
 * @param storeProp
 */
export function connect(
  store: Store,
  mapStoreToProps: MapStoreToProps = defaultMapStoreToProps,
  forwardRef: boolean = false
): ConsumerDecorator {
  const { name, context } = store;

  /**
   * @function connect
   * @param Component
   */
  return function(Component: React.ComponentType<Props>) {
    /**
     * @class StoreConsumer
     */
    class StoreConsumer extends React.Component<Props> {
      /**
       * @method componentRender
       * @param state
       */
      private componentRender = (data: ContextState) => {
        if (!data.mounted) {
          throw new ReferenceError(`Store <${name}> provider not yet mounted on the parent or current component`);
        }

        const { store } = data;
        const { forwardRef, ...rest } = this.props;
        const props = { ...rest, ...mapStoreToProps(store, store.state, this.props) };

        return <Component {...props} ref={forwardRef} />;
      };

      /**
       * @method render
       */
      public render() {
        const { Consumer } = context;

        return <Consumer>{this.componentRender}</Consumer>;
      }
    }

    // Fallback forwardRef
    if (forwardRef) {
      return React.forwardRef((props: Props, ref: React.Ref<any>) => <StoreConsumer {...props} forwardRef={ref} />);
    }

    // Return StoreConsumer
    return StoreConsumer;
  };
}
