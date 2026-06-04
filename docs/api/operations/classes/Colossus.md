[**ts-chef API Documentation**](../../README.md)

***

[ts-chef API Documentation](../../modules.md) / [operations](../README.md) / Colossus

# Class: Colossus

Defined in: [operations/Colossus.ts:19](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L19)

Base class for all operations in ts-chef.
Each operation defines its metadata and implementation for data transformation.

## Extends

- [`Operation`](../../Operation/classes/Operation.md)

## Constructors

### Constructor

> **new Colossus**(): `Colossus`

#### Returns

`Colossus`

#### Inherited from

[`Operation`](../../Operation/classes/Operation.md).[`constructor`](../../Operation/classes/Operation.md#constructor)

## Properties

### args

> **args**: [`ArgConfig`](../../Operation/interfaces/ArgConfig.md)[]

Defined in: [operations/Colossus.ts:28](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L28)

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

> **description**: `string` = `"Colossus is the name of the world's first electronic computer. Ten Colossi were designed by Tommy Flowers and built at the Post Office Research Labs at Dollis Hill in 1943 during World War 2. They assisted with the breaking of the German Lorenz cipher attachment, a machine created to encipher communications between Hitler and his generals on the front lines.<br><br>To learn more, Virtual Colossus, an online, browser based simulation of a Colossus computer is available at <a href='https://virtualcolossus.co.uk' target='_blank'>virtualcolossus.co.uk</a>.<br><br>A more detailed description of this operation can be found <a href='https://github.com/gchq/CyberChef/wiki/Colossus' target='_blank'>here</a>."`

Defined in: [operations/Colossus.ts:22](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L22)

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

> **infoURL**: `string` = `"https://wikipedia.org/wiki/Colossus_computer"`

Defined in: [operations/Colossus.ts:24](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L24)

Optional URL for more information about the operation or algorithm.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`infoURL`](../../Operation/classes/Operation.md#infourl)

***

### inputType

> **inputType**: `string` = `"string"`

Defined in: [operations/Colossus.ts:25](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L25)

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

> **module**: `string` = `"Bletchley"`

Defined in: [operations/Colossus.ts:21](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L21)

Category or module the operation belongs to.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`module`](../../Operation/classes/Operation.md#module)

***

### name

> **name**: `string` = `"Colossus"`

Defined in: [operations/Colossus.ts:20](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L20)

Internal name of the operation.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`name`](../../Operation/classes/Operation.md#name)

***

### outputType

> **outputType**: `string` = `"JSON"`

Defined in: [operations/Colossus.ts:26](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L26)

Expected output data type.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`outputType`](../../Operation/classes/Operation.md#outputtype)

***

### presentType

> **presentType**: `string` = `"html"`

Defined in: [operations/Colossus.ts:27](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L27)

Type for presentation purposes.

#### Overrides

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

> **present**(`output`): `string`

Defined in: [operations/Colossus.ts:593](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L593)

Formats the output data for presentation.

#### Parameters

##### output

`any`

#### Returns

`string`

The formatted presentation data.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`present`](../../Operation/classes/Operation.md#present)

***

### run()

> **run**(`input`, `args`): `any`

Defined in: [operations/Colossus.ts:372](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L372)

Executes the operation.

#### Parameters

##### input

`string`

The data to process.

##### args

`any`[]

The arguments for the operation.

#### Returns

`any`

The processed data.

#### Overrides

[`Operation`](../../Operation/classes/Operation.md).[`run`](../../Operation/classes/Operation.md#run)

***

### selectProgram()

> **selectProgram**(`progname`, `args`): `any`[]

Defined in: [operations/Colossus.ts:516](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/operations/Colossus.ts#L516)

#### Parameters

##### progname

`string`

##### args

`any`[]

#### Returns

`any`[]
