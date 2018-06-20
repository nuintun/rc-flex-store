/**
 * @module index
 * @license MIT
 * @see https://reactjs.org/docs/context.html
 */

import * as React from 'react';
import { Callback, isFunction, generateStoreName } from './utils';
import Repository, { StoreState, StoreUpdater, StoreWatcher, StoreSubscriber } from './store';

export type UserStore = {
  [key: string]: any;
  readonly state: StoreState;
  subscribe(fn: StoreSubscriber): void;
  unsubscribe(fn: StoreSubscriber): void;
  setState(updater: StoreUpdater, callback?: Callback): void;
};
export type State = {
  name: string;
  version: number;
  mounted: boolean;
  store: UserStore;
};
export type Store = {
  readonly state: State;
  watch(fn: StoreWatcher): void;
  unwatch(fn: StoreWatcher): void;
  readonly context: React.Context<StoreState>;
};
export interface Props extends React.ClassAttributes<any> {
  forwardRef?: any;
  [prop: string]: any;
}
export type Updaters = { [updater: string]: any };
export type Provider = (Component: React.ComponentType) => any;
export type Consumer = (Component: React.ComponentType) => any;
export type MapStoreToProps = (store: UserStore, state: StoreState, props: Props) => Props;

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
  const state: State = { name: name || generateStoreName(), version: Date.now(), mounted: false, store };

  // Store
  return Object.defineProperties(Object.create(null), {
    state: { value: state },
    watch: { value: watch },
    unwatch: { value: unwatch },
    context: { value: React.createContext(state), enumerable: true }
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
): Provider {
  const { watch, unwatch, context, state } = store;

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
      public readonly state: State;

      /**
       * @constructor
       * @param props
       * @param context
       */
      constructor(props: Props, context: React.Context<any>) {
        super(props, context);

        // Initialization state
        this.state = {
          mounted: true,
          name: state.name,
          store: state.store,
          version: state.version
        };

        // Subscribe store change
        watch(this.storeUpdater);
      }

      /**
       * @method storeUpdater
       */
      private storeUpdater: StoreWatcher = (updater: () => StoreState, callback: Callback) => {
        this.setState(() => {
          // If null return null
          if (updater() === null) {
            return null;
          }

          // Change timestamp trigger provider update
          return { version: Date.now() };
        }, callback);
      };

      /**
       * @method componentWillUnmount
       */
      public componentWillUnmount() {
        // Unsubscribe store change
        unwatch(this.storeUpdater);
      }

      /**
       * @method render
       */
      public render() {
        const state = this.state;
        const { Provider } = context;
        const { store: repository } = state;
        const { forwardRef, ...rest } = this.props;
        const props = { ...rest, ...mapStoreToProps(repository, repository.state, this.props) };

        return (
          <Provider value={state}>
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
): Consumer {
  const { context } = store;

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
      private componentRender = (state: State) => {
        if (!state.mounted) {
          throw new ReferenceError(`Store <${state.name}> provider not yet mounted on the parent or current component`);
        }

        const { store: repository } = state;
        const { forwardRef, ...rest } = this.props;
        const props = { ...rest, ...mapStoreToProps(repository, repository.state, this.props) };

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
