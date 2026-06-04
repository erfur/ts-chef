[**ts-chef API Documentation**](../../README.md)

***

[ts-chef API Documentation](../../modules.md) / [Operation](../README.md) / ArgConfig

# Interface: ArgConfig

Defined in: [Operation.ts:12](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L12)

Configuration for an operation argument.

## Properties

### defaultIndex?

> `optional` **defaultIndex?**: `number`

Defined in: [Operation.ts:30](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L30)

Default index for selection-based arguments.

***

### disabled?

> `optional` **disabled?**: `boolean`

Defined in: [Operation.ts:26](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L26)

Whether the argument is disabled.

***

### hint?

> `optional` **hint?**: `string`

Defined in: [Operation.ts:22](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L22)

A hint or tooltip for the argument.

***

### max?

> `optional` **max?**: `number`

Defined in: [Operation.ts:36](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L36)

Maximum value for numeric arguments.

***

### maxLength?

> `optional` **maxLength?**: `number`

Defined in: [Operation.ts:32](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L32)

Maximum length for string arguments.

***

### min?

> `optional` **min?**: `number`

Defined in: [Operation.ts:34](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L34)

Minimum value for numeric arguments.

***

### name

> **name**: `string`

Defined in: [Operation.ts:14](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L14)

The display name of the argument.

***

### rows?

> `optional` **rows?**: `number`

Defined in: [Operation.ts:24](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L24)

Number of rows for textarea-like arguments.

***

### step?

> `optional` **step?**: `number`

Defined in: [Operation.ts:38](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L38)

Step value for numeric arguments.

***

### target?

> `optional` **target?**: `number` \| `number`[]

Defined in: [Operation.ts:28](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L28)

Target indices for dynamic arguments.

***

### toggleValues?

> `optional` **toggleValues?**: `string`[]

Defined in: [Operation.ts:20](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L20)

Optional values for 'option' type arguments.

***

### type

> **type**: `string`

Defined in: [Operation.ts:16](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L16)

The type of the argument (e.g., 'string', 'number', 'option').

***

### value

> **value**: `unknown`

Defined in: [Operation.ts:18](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L18)

The default or current value of the argument.
