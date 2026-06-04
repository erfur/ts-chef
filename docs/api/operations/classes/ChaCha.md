[**ts-chef API Documentation**](../../README.md)

***

[ts-chef API Documentation](../../modules.md) / [operations](../README.md) / ChaCha

# Class: ChaCha

Defined in: [operations/ChaCha.ts:79](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L79)

Base class for all operations in ts-chef.
Each operation defines its metadata and implementation for data transformation.

## Extends

- [`Operation`](../../Operation/classes/Operation.md)

## Constructors

### Constructor

> **new ChaCha**(): `ChaCha`

#### Returns

`ChaCha`

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`constructor`](../../Operation/classes/Operation.md#constructor)

## Properties

### args

> **args**: [`ArgConfig`](../../Operation/interfaces/ArgConfig.md)[]

Defined in: [operations/ChaCha.ts:87](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L87)

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

> **description**: `string` = `"ChaCha is a stream cipher designed by Daniel J. Bernstein. It is a variant of the Salsa stream cipher. Several parameterizations exist; 'ChaCha' may refer to the original construction, or to the variant as described in RFC-8439. ChaCha is often used with Poly1305, in the ChaCha20-Poly1305 AEAD construction.<br><br><b>Key:</b> ChaCha uses a key of 16 or 32 bytes (128 or 256 bits).<br><br><b>Nonce:</b> ChaCha uses a nonce of 8 or 12 bytes (64 or 96 bits).<br><br><b>Counter:</b> ChaCha uses a counter of 4 or 8 bytes (32 or 64 bits); together, the nonce and counter must add up to 16 bytes. The counter starts at zero at the start of the keystream, and is incremented at every 64 bytes."`

Defined in: [operations/ChaCha.ts:82](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L82)

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

> **infoURL**: `string` = `"https://wikipedia.org/wiki/Salsa20#ChaCha_variant"`

Defined in: [operations/ChaCha.ts:84](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L84)

Optional URL for more information about the operation or algorithm.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`infoURL`](../../Operation/classes/Operation.md#infourl)

***

### inputType

> **inputType**: `string` = `"string"`

Defined in: [operations/ChaCha.ts:85](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L85)

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

> **module**: `string` = `"Ciphers"`

Defined in: [operations/ChaCha.ts:81](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L81)

Category or module the operation belongs to.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`module`](../../Operation/classes/Operation.md#module)

***

### name

> **name**: `string` = `"ChaCha"`

Defined in: [operations/ChaCha.ts:80](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L80)

Internal name of the operation.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`name`](../../Operation/classes/Operation.md#name)

***

### outputType

> **outputType**: `string` = `"string"`

Defined in: [operations/ChaCha.ts:86](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L86)

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

> **run**(`input`, `args`): `string`

Defined in: [operations/ChaCha.ts:123](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/ChaCha.ts#L123)

Executes the operation.

#### Parameters

##### input

`string`

The data to process.

##### args

`any`[]

The arguments for the operation.

#### Returns

`string`

The processed data.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`run`](../../Operation/classes/Operation.md#run)
