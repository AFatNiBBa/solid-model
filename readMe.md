
# solid-model
Automatic view model for solid-js

## Objective
This package aims to provide reactive objects, is similiar to `createMutable()` but with a few differences
- **Seamless**: It works with classes and, hopefully, any kind of JavaScript object in a completely transparent way
- **Customizable**: Greater control over the interactions with the proxy
- **Scoped**: It doesn't automatically apply reactivity to children of reactive objects

## Standard `ProxyHandler`s
The module provides a set of `ProxyHandler`s out-of-the-box that can be used to customize the reactive behaviours of objects.
These handlers are available through inheritable classes, since the default ones haven't got any instance field you can use their prototype directly.
Any instance field defined on handlers will be defined on their proxy, especially private fields.
Each handler also provides static methods for introspection, these works on both the raw object and its reactive proxy.
For example
```ts
import { MemoHandler } from "solid-model";

const raw = { /* ... */ };
const reactive = MemoHandler.create(raw);
```

### `BaseHandler`
- `is()` (static): Tells whether the provided object is reactive
- `getProxy()` (static): Gets the proxy of a reactive object
- `setProxy()` (static): Sets the proxy of a reactive object
- `getRaw()` (static): Gets the raw version of a reactive object
- `create()`: Creates a proxy for an object using the current handler

### `ReactiveHandler`
Handler that makes an `Atom` under the hood for each field of its target
- `getStore()` (static): Gets the object (Of type `Store`) that contains the `Atom`s for each reactive property

It also provides a few custom overridable traps
- `createAtom()`: Method that's responsible for creating the `Atom` for each property which hasn't got neither a getter nor a setter
- `getComparator()`: Method that creates a comparison function for the `Signal` of each new `Atom` created by the current handler
- `getPropertyTag()`: Method that generates a recognizable name for the `Signal` of each `Atom` to help debugging

### `DisposableHandler`
Handler that provides a general-purpose `DisposableOwner`
- `getOwner()` (static): Gets the `DisposableOwner` that handles the reactive resources of the current object
- `createOwner()`: Method that's responsible for creating the `DisposableOwner` for each object that uses `DisposableHandler`

### `MemoHandler`
Handler that inherits the behaviours of `ReactiveHandler` and memoizes every getter of its target
- `createMemo()`: Method that's responsible for creating the `ReadOnlyAtom` for each getter property

## Utility
The module also exposes some of its internal utilities
- `nameOf()`: Utility function that powers `Atom.prop()`

### `Store`
The type of the output of `ReactiveHandler.getStore()`

### `DisposableOwner`
Explicitly disposable version of a **"solid-js"** `Owner`

### `ReadOnlyAtom`
Represents a POSSIBLY read-only reactive state
- `trySet()`: Allows you to try to set the value of a `ReadOnlyAtom` in the hope that it's actually a normal `Atom`
- `update()`: Like the `Setter` overload of a `Signal` that takes a function with the previous value

### `Atom`
Customizable and simplified wrappers for reactive states.
- (Everything `ReadOnlyAtom` has)
- `convert()`: Creates a new `Atom` that applies a conversion to the current one
- `unwrap()` (static): Allows the use of an `Accessor` of an `Atom` without having to call the `Accessor` each time
- `from()` (static): Creates an `Atom` based on a `Signal`
- `prop()` (static): Creates an `Atom` based on an object property
- `source()` (static): Similiar to `Atom.unwrap()`, but if the `Accessor` doesn't return anything it automatically creates an internal `Signal` in which to store the value