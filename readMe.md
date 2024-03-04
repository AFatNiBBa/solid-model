
# solid-model
Automatic view model for solid-js

## Objective
This package aims to provide reactive objects, is similiar to `createMutable()` but with a few differences
- **Seamless**: It works with classes and, hopefully, any kind of JavaScript object in a completely transparent way
- **Customizable**: Greater control over the interactions with the proxy
- **Scoped**: It doesn't automatically apply reactivity to children of reactive objects

## Reactive interaction
The module provides the `Reactive` namespace, which contains some utility methods to interact with reactive objects
- **`is()`**: Tells whether the provided object is reactive
- **`getProxy()`**: Gets the proxy of a reactive object
- **`getRaw()`**: Gets the raw version of a reactive object
- **`getStore()`**: Gets the object (Of type `Store`) that contains the reactive `Accessor`s for each property (Technically `IProperty`)
- **`getOwner()`**: Gets the **"solid-js"** `Owner` that handles the reactive resources of the current object
- **`dispose()`**: Removes the proxy from the raw object, this has two effects
  - The next time you call `Reactive.create()`, a new proxy will be created instead of recycling the previous one
  - The proxy will be potentially eligible for garbage collection even if the raw object still isn't
- **`create()`**: Creates a reactive proxy for an object
  > It accepts a second optional parameter that allows you to specify a custom `ProxyHandler` to customize the behaviour of the reactive object. The default one is `SignalHandler.prototype`

Each of these methods works on both the raw object and its reactive proxy

## Standard `ProxyHandler`s
The module provides a set of `ProxyHandler`s out-of-the-box that can be used to customize the reactive behaviours of objects.
These handlers are available through inheritable classes, since the default ones haven't got any instance field you can use their prototype directly.
For example
```ts
import { Reactive, MemoHandler } from "solid-model";

const raw = { /* ... */ };
const reactive = Reactive.create(raw, MemoHandler.prototype);
```

### `SignalHandler`
Handler that makes a `Signal` under the hood for each field of its target and provides a few overridable methods
- **`createSignal()`**: Method that's responsible for creating the `IProperty` for each property which hasn't got neither a getter nor a setter
- **`getPropertyTag()`**: Method that generates a recognizable name for the `Signal` of each `IProperty` to help debugging

### `MemoHandler`
Handler that inherits the behaviours of `SignalHandler`, memoizes every getter of its target and provides the following overridable methods
- **`createMemo()`**: Method that's responsible for creating the `IProperty` for each getter property
- **`onCircular()`**: Hook that handles the eventuality of a getter calling itself during its memoization phase

## Utility
The module also provides the following utilities:
- **`Store`**: The type of the output of `Reactive.getStore()`
- **`IProperty`**: The type that represents the reactive behaviour of a single property; It's stored inside of the `Store` of its object
- **`getGetter()`**: Fast method to get the eventual getter of a property across the prototype chain