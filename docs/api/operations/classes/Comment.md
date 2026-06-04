[**ts-chef API Documentation**](../../README.md)

***

[ts-chef API Documentation](../../modules.md) / [operations](../README.md) / Comment

# Class: Comment

Defined in: [operations/Comment.ts:16](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L16)

Base class for all operations in ts-chef.
Each operation defines its metadata and implementation for data transformation.

## Extends

- [`Operation`](../../Operation/classes/Operation.md)

## Constructors

### Constructor

> **new Comment**(): `Comment`

#### Returns

`Comment`

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`constructor`](../../Operation/classes/Operation.md#constructor)

## Properties

### args

> **args**: [`ArgConfig`](../../Operation/interfaces/ArgConfig.md)[]

Defined in: [operations/Comment.ts:24](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L24)

List of arguments the operation accepts.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`args`](../../Operation/classes/Operation.md#args)

***

### checks?

> `optional` **checks?**: `object`[]

Defined in: [Operation.ts:76](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L76)

Patterns and flags for automatic detection.

#### args

> **args**: `unknown`[]

#### flags

> **flags**: `string`

#### pattern

> **pattern**: `string`

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`checks`](../../Operation/classes/Operation.md#checks)

***

### description

> **description**: `string` = `"Provides a place to write comments within the flow of the recipe. This operation has no computational effect."`

Defined in: [operations/Comment.ts:19](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L19)

Human-readable description of what the operation does.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`description`](../../Operation/classes/Operation.md#description)

***

### flowControl

> **flowControl**: `boolean` = `true`

Defined in: [operations/Comment.ts:23](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L23)

Whether the operation supports flow control.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`flowControl`](../../Operation/classes/Operation.md#flowcontrol)

***

### infoURL

> **infoURL**: `string` \| `null` = `null`

Defined in: [Operation.ts:62](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L62)

Optional URL for more information about the operation or algorithm.

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`infoURL`](../../Operation/classes/Operation.md#infourl)

***

### inputType

> **inputType**: `string` = `"string"`

Defined in: [operations/Comment.ts:21](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L21)

Expected input data type.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`inputType`](../../Operation/classes/Operation.md#inputtype)

***

### manualBake

> **manualBake**: `boolean` = `false`

Defined in: [Operation.ts:72](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L72)

Whether the operation requires manual triggering.

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`manualBake`](../../Operation/classes/Operation.md#manualbake)

***

### module

> **module**: `string` = `"Default"`

Defined in: [operations/Comment.ts:18](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L18)

Category or module the operation belongs to.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`module`](../../Operation/classes/Operation.md#module)

***

### name

> **name**: `string` = `"Comment"`

Defined in: [operations/Comment.ts:17](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L17)

Internal name of the operation.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`name`](../../Operation/classes/Operation.md#name)

***

### outputType

> **outputType**: `string` = `"string"`

Defined in: [operations/Comment.ts:22](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L22)

Expected output data type.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`outputType`](../../Operation/classes/Operation.md#outputtype)

***

### presentType

> **presentType**: `string` = `"string"`

Defined in: [Operation.ts:68](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L68)

Type for presentation purposes.

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`presentType`](../../Operation/classes/Operation.md#presenttype)

## Methods

### highlight()

> **highlight**(`_pos`, `_args`): [`HighlightResult`](../../Operation/type-aliases/HighlightResult.md)

Defined in: [Operation.ts:104](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L104)

Calculates highlight ranges based on input selection.

#### Parameters

##### \_pos

[`HighlightPos`](../../Operation/type-aliases/HighlightPos.md)

##### \_args

`any`[]

#### Returns

[`HighlightResult`](../../Operation/type-aliases/HighlightResult.md)

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`highlight`](../../Operation/classes/Operation.md#highlight)

***

### highlightReverse()

> **highlightReverse**(`_pos`, `_args`): [`HighlightResult`](../../Operation/type-aliases/HighlightResult.md)

Defined in: [Operation.ts:112](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L112)

Calculates highlight ranges in the input based on output selection.

#### Parameters

##### \_pos

[`HighlightPos`](../../Operation/type-aliases/HighlightPos.md)

##### \_args

`any`[]

#### Returns

[`HighlightResult`](../../Operation/type-aliases/HighlightResult.md)

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`highlightReverse`](../../Operation/classes/Operation.md#highlightreverse)

***

### present()

> **present**(`data`, `_args`): `any`

Defined in: [Operation.ts:96](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L96)

Formats the output data for presentation.

#### Parameters

##### data

`any`

The output data from the run method.

##### \_args

`any`[]

The arguments used.

#### Returns

`any`

The formatted presentation data.

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`present`](../../Operation/classes/Operation.md#present)

***

### run()

> **run**(`input`, `_args`): `string`

Defined in: [operations/Comment.ts:32](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Comment.ts#L32)

Executes the operation.

#### Parameters

##### input

`string`

The data to process.

##### \_args

`any`[]

#### Returns

`string`

The processed data.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`run`](../../Operation/classes/Operation.md#run)
