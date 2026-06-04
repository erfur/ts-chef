[**ts-chef API Documentation**](../../README.md)

***

[ts-chef API Documentation](../../modules.md) / [operations](../README.md) / CBORDecode

# Class: CBORDecode

Defined in: [operations/CBORDecode.ts:17](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L17)

Base class for all operations in ts-chef.
Each operation defines its metadata and implementation for data transformation.

## Extends

- [`Operation`](../../Operation/classes/Operation.md)

## Constructors

### Constructor

> **new CBORDecode**(): `CBORDecode`

#### Returns

`CBORDecode`

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`constructor`](../../Operation/classes/Operation.md#constructor)

## Properties

### args

> **args**: [`ArgConfig`](../../Operation/interfaces/ArgConfig.md)[] = `[]`

Defined in: [operations/CBORDecode.ts:25](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L25)

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

> **description**: `string` = `"Concise Binary Object Representation (CBOR) is a binary data serialization format loosely based on JSON. Like JSON it allows the transmission of data objects that contain name–value pairs, but in a more concise manner. This increases processing and transfer speeds at the cost of human readability. It is defined in IETF RFC 8949."`

Defined in: [operations/CBORDecode.ts:20](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L20)

Human-readable description of what the operation does.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`description`](../../Operation/classes/Operation.md#description)

***

### flowControl

> **flowControl**: `boolean` = `false`

Defined in: [Operation.ts:70](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L70)

Whether the operation supports flow control.

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`flowControl`](../../Operation/classes/Operation.md#flowcontrol)

***

### infoURL

> **infoURL**: `string` = `"https://wikipedia.org/wiki/CBOR"`

Defined in: [operations/CBORDecode.ts:22](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L22)

Optional URL for more information about the operation or algorithm.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`infoURL`](../../Operation/classes/Operation.md#infourl)

***

### inputType

> **inputType**: `string` = `"ArrayBuffer"`

Defined in: [operations/CBORDecode.ts:23](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L23)

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

> **module**: `string` = `"Serialise"`

Defined in: [operations/CBORDecode.ts:19](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L19)

Category or module the operation belongs to.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`module`](../../Operation/classes/Operation.md#module)

***

### name

> **name**: `string` = `"CBOR Decode"`

Defined in: [operations/CBORDecode.ts:18](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L18)

Internal name of the operation.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`name`](../../Operation/classes/Operation.md#name)

***

### outputType

> **outputType**: `string` = `"JSON"`

Defined in: [operations/CBORDecode.ts:24](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L24)

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

> **run**(`input`, `args`): `any`

Defined in: [operations/CBORDecode.ts:27](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/CBORDecode.ts#L27)

Executes the operation.

#### Parameters

##### input

`any`

The data to process.

##### args

`any`[]

The arguments for the operation.

#### Returns

`any`

The processed data.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`run`](../../Operation/classes/Operation.md#run)
