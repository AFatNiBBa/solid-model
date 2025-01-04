
# solid-model
Automatic view model for solid-js

## Objective
This package aims to provide reactive objects, is similiar to `createMutable()` but with a few differences
- **Seamless**: It works with classes and, hopefully, any kind of JavaScript object in a completely transparent way
- **Customizable**: Greater control over the interactions with the proxy
- **Scoped**: It doesn't automatically apply reactivity to children of reactive objects

## Documentation

### Standard `ProxyHandler`s
The module provides a set of `ProxyHandler`s out-of-the-box that can be used to customize the reactive behaviours of objects.
These handlers are available through inheritable classes, since the default ones haven't got any instance field you can use their prototype directly.
Any instance field defined on handlers will be defined on their proxy, especially private fields.
Each handler also provides static methods for introspection, these works on both the raw object and its reactive proxy.
You should use the static methods provided by the handler you're actually using since they could be overridden adding more specific behaviours.
For example:
```ts
import { MemoHandler } from "solid-model";

const raw = { /* ... */ };
const reactive = MemoHandler.create(raw);
```

#### `BaseHandler`
- `is()` (static): Tells whether the provided object is reactive
- `getProxy()` (static): Gets the proxy of a reactive object
- `setProxy()` (static): Sets the proxy of a reactive object
- `getRaw()` (static): Gets the raw version of a reactive object
- `create()` (static): Creates a proxy for an object using the current handler
- `detach()` (static): Detaches the proxy from its target

#### `ReactiveHandler`
Handler that makes an `Atom` under the hood for each field of its target
- `getStore()` (static): Gets the object (Of type `Store`) that contains a `Forcer` for each tracked property
- `track()`: Tracks the given key in the current effect
- `update()`: Forces an update on the effects that are tracking the given key
- `compare()`: Checks whether the value of a certain property has changed
- `tag()`: Obtains a tag for given a property that will be used as a name for its related internals

#### `DisposableHandler`
Handler that provides a general-purpose `DisposableOwner`
- `getOwner()` (static): Gets the `DisposableOwner` that handles the reactive resources of the current object
- `owner()`: Method that's responsible for creating the `DisposableOwner` for each object that uses `DisposableHandler`

#### `MemoHandler`
Handler that inherits the behaviours of `ReactiveHandler` and memoizes every getter of its target
- `getCache()` (static): Gets the object (Of type `Cache`) that contains the memos of the cached getters
- `reset()` (static): Deletes the memo of a property and notifies its update, thus forcing the memo to be recreated
- `memoize()`: Creates and saves a memo for a property
- `circular()`: Provides a fallback value for when a getter calls itself while being memoized

#### `ReactiveArrayHandler`
Handler that makes `ReactiveArray`s work with **"solid-js"**

### Utility
The module also exposes some of its internal utilities
- `DisposableOwner`: Explicitly disposable version of a **"solid-js"** `Owner`
- `Forcer`: Object that allows `ReactiveHandler` to make properties reactive
- `Store`: The type of the output of `ReactiveHandler.getStore()`
- `Cache`: The type of the output of `MemoHandler.getCache()`
- `ForceTarget`: Type that represents what can be targeted by `ReactiveHandler.track()` and `ReactiveHandler.update()`
- `CircularGetterError`: Type of the error thrown by the base implementation of `MemoHandler.circular()`
- `Identity`: Class that returns whatever was passed to it
- `Internal`: A collection of symbols that each represents an internal of an object
- `staticCall()`: Makes an instance function static
- `getGetter()`: Gets the eventual getter of a property across the prototype chain

#### `ReactiveArray`
Reactive version of the `Array`
- `update()`: Forces an update on all the effects that track the length of the current `Array`