[**ts-chef API Documentation**](../../README.md)

***

[ts-chef API Documentation](../../modules.md) / [Operation](../README.md) / Operation

# Abstract Class: Operation

Defined in: [Operation.ts:54](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L54)

Base class for all operations in ts-chef.
Each operation defines its metadata and implementation for data transformation.

## Extended by

- [`A1Z26CipherDecode`](../../operations/classes/A1Z26CipherDecode.md)
- [`A1Z26CipherEncode`](../../operations/classes/A1Z26CipherEncode.md)
- [`ADD`](../../operations/classes/ADD.md)
- [`AddLineNumbers`](../../operations/classes/AddLineNumbers.md)
- [`Adler32Checksum`](../../operations/classes/Adler32Checksum.md)
- [`AESDecrypt`](../../operations/classes/AESDecrypt.md)
- [`AESEncrypt`](../../operations/classes/AESEncrypt.md)
- [`AESKeyUnwrap`](../../operations/classes/AESKeyUnwrap.md)
- [`AESKeyWrap`](../../operations/classes/AESKeyWrap.md)
- [`AffineCipherDecode`](../../operations/classes/AffineCipherDecode.md)
- [`AffineCipherEncode`](../../operations/classes/AffineCipherEncode.md)
- [`AlternatingCaps`](../../operations/classes/AlternatingCaps.md)
- [`AMFDecode`](../../operations/classes/AMFDecode.md)
- [`AMFEncode`](../../operations/classes/AMFEncode.md)
- [`AnalyseHash`](../../operations/classes/AnalyseHash.md)
- [`AnalyseUUID`](../../operations/classes/AnalyseUUID.md)
- [`AND`](../../operations/classes/AND.md)
- [`Argon2`](../../operations/classes/Argon2.md)
- [`Argon2Compare`](../../operations/classes/Argon2Compare.md)
- [`AtbashCipher`](../../operations/classes/AtbashCipher.md)
- [`AvroToJSON`](../../operations/classes/AvroToJSON.md)
- [`BaconCipherDecode`](../../operations/classes/BaconCipherDecode.md)
- [`BaconCipherEncode`](../../operations/classes/BaconCipherEncode.md)
- [`Bcrypt`](../../operations/classes/Bcrypt.md)
- [`BcryptCompare`](../../operations/classes/BcryptCompare.md)
- [`BcryptParse`](../../operations/classes/BcryptParse.md)
- [`BifidCipherDecode`](../../operations/classes/BifidCipherDecode.md)
- [`BifidCipherEncode`](../../operations/classes/BifidCipherEncode.md)
- [`BitShiftLeft`](../../operations/classes/BitShiftLeft.md)
- [`BitShiftRight`](../../operations/classes/BitShiftRight.md)
- [`BLAKE2b`](../../operations/classes/BLAKE2b.md)
- [`BLAKE2s`](../../operations/classes/BLAKE2s.md)
- [`BLAKE3`](../../operations/classes/BLAKE3.md)
- [`BlowfishDecrypt`](../../operations/classes/BlowfishDecrypt.md)
- [`BlowfishEncrypt`](../../operations/classes/BlowfishEncrypt.md)
- [`Bombe`](../../operations/classes/Bombe.md)
- [`BSONDeserialise`](../../operations/classes/BSONDeserialise.md)
- [`BSONSerialise`](../../operations/classes/BSONSerialise.md)
- [`Bzip2Compress`](../../operations/classes/Bzip2Compress.md)
- [`Bzip2Decompress`](../../operations/classes/Bzip2Decompress.md)
- [`CaesarBoxCipher`](../../operations/classes/CaesarBoxCipher.md)
- [`CBORDecode`](../../operations/classes/CBORDecode.md)
- [`CBOREncode`](../../operations/classes/CBOREncode.md)
- [`ChaCha`](../../operations/classes/ChaCha.md)
- [`ChangeIPFormat`](../../operations/classes/ChangeIPFormat.md)
- [`CaretMdecode`](../../operations/classes/CaretMdecode.md)
- [`CartesianProduct`](../../operations/classes/CartesianProduct.md)
- [`CetaceanCipherDecode`](../../operations/classes/CetaceanCipherDecode.md)
- [`CetaceanCipherEncode`](../../operations/classes/CetaceanCipherEncode.md)
- [`ChiSquare`](../../operations/classes/ChiSquare.md)
- [`CipherSaber2Decrypt`](../../operations/classes/CipherSaber2Decrypt.md)
- [`CipherSaber2Encrypt`](../../operations/classes/CipherSaber2Encrypt.md)
- [`CitrixCTX1Decode`](../../operations/classes/CitrixCTX1Decode.md)
- [`CitrixCTX1Encode`](../../operations/classes/CitrixCTX1Encode.md)
- [`CMAC`](../../operations/classes/CMAC.md)
- [`Colossus`](../../operations/classes/Colossus.md)
- [`Comment`](../../operations/classes/Comment.md)
- [`CSVToJSON`](../../operations/classes/CSVToJSON.md)
- [`CTPH`](../../operations/classes/CTPH.md)
- [`CompareCTPHHashes`](../../operations/classes/CompareCTPHHashes.md)
- [`CompareSSDEEPHashes`](../../operations/classes/CompareSSDEEPHashes.md)
- [`CSSSelector`](../../operations/classes/CSSSelector.md)
- [`ConditionalJump`](../../operations/classes/ConditionalJump.md)
- [`ConvertArea`](../../operations/classes/ConvertArea.md)
- [`ConvertCoordinateFormat`](../../operations/classes/ConvertCoordinateFormat.md)
- [`ConvertDataUnits`](../../operations/classes/ConvertDataUnits.md)
- [`ConvertDistance`](../../operations/classes/ConvertDistance.md)
- [`ConvertMass`](../../operations/classes/ConvertMass.md)
- [`ConvertSpeed`](../../operations/classes/ConvertSpeed.md)
- [`ConvertLeetSpeak`](../../operations/classes/ConvertLeetSpeak.md)
- [`ConvertToNATOAlphabet`](../../operations/classes/ConvertToNATOAlphabet.md)
- [`CountOccurrences`](../../operations/classes/CountOccurrences.md)
- [`CRCChecksum`](../../operations/classes/CRCChecksum.md)
- [`CSSBeautify`](../../operations/classes/CSSBeautify.md)
- [`CSSMinify`](../../operations/classes/CSSMinify.md)
- [`DropBytes`](../../operations/classes/DropBytes.md)
- [`DropNthBytes`](../../operations/classes/DropNthBytes.md)
- [`ExpandAlphabetRange`](../../operations/classes/ExpandAlphabetRange.md)
- [`Filter`](../../operations/classes/Filter.md)
- [`FindReplace`](../../operations/classes/FindReplace.md)
- [`FromBase64`](../../operations/classes/FromBase64.md)
- [`FromBinary`](../../operations/classes/FromBinary.md)
- [`FromCharcode`](../../operations/classes/FromCharcode.md)
- [`FromDecimal`](../../operations/classes/FromDecimal.md)
- [`FromFloat`](../../operations/classes/FromFloat.md)
- [`FromHex`](../../operations/classes/FromHex.md)
- [`FromHexContent`](../../operations/classes/FromHexContent.md)
- [`FromHexdump`](../../operations/classes/FromHexdump.md)
- [`FromHTMLEntity`](../../operations/classes/FromHTMLEntity.md)
- [`FromMorseCode`](../../operations/classes/FromMorseCode.md)
- [`FromOctal`](../../operations/classes/FromOctal.md)
- [`FromQuotedPrintable`](../../operations/classes/FromQuotedPrintable.md)
- [`FromUNIXTimestamp`](../../operations/classes/FromUNIXTimestamp.md)
- [`GenerateUUID`](../../operations/classes/GenerateUUID.md)
- [`GenericCodeBeautify`](../../operations/classes/GenericCodeBeautify.md)
- [`GetAllCasings`](../../operations/classes/GetAllCasings.md)
- [`GetTime`](../../operations/classes/GetTime.md)
- [`HammingDistance`](../../operations/classes/HammingDistance.md)
- [`Head`](../../operations/classes/Head.md)
- [`HTMLToText`](../../operations/classes/HTMLToText.md)
- [`IndexOfCoincidence`](../../operations/classes/IndexOfCoincidence.md)
- [`JSONBeautify`](../../operations/classes/JSONBeautify.md)
- [`JSONMinify`](../../operations/classes/JSONMinify.md)
- [`JSONToCSV`](../../operations/classes/JSONToCSV.md)
- [`JWTDecode`](../../operations/classes/JWTDecode.md)
- [`Label`](../../operations/classes/Label.md)
- [`LevenshteinDistance`](../../operations/classes/LevenshteinDistance.md)
- [`LuhnChecksum`](../../operations/classes/LuhnChecksum.md)
- [`LZStringCompress`](../../operations/classes/LZStringCompress.md)
- [`LZStringDecompress`](../../operations/classes/LZStringDecompress.md)
- [`Mean`](../../operations/classes/Mean.md)
- [`Median`](../../operations/classes/Median.md)
- [`Merge`](../../operations/classes/Merge.md)
- [`MicrosoftScriptDecoder`](../../operations/classes/MicrosoftScriptDecoder.md)
- [`MurmurHash3`](../../operations/classes/MurmurHash3.md)
- [`Multiply`](../../operations/classes/Multiply.md)
- [`NormaliseUnicode`](../../operations/classes/NormaliseUnicode.md)
- [`NOT`](../../operations/classes/NOT.md)
- [`Numberwang`](../../operations/classes/Numberwang.md)
- [`OR`](../../operations/classes/OR.md)
- [`PadLines`](../../operations/classes/PadLines.md)
- [`ParseURI`](../../operations/classes/ParseURI.md)
- [`PowerSet`](../../operations/classes/PowerSet.md)
- [`PseudoRandomIntegerGenerator`](../../operations/classes/PseudoRandomIntegerGenerator.md)
- [`RegularExpression`](../../operations/classes/RegularExpression.md)
- [`RemoveLineNumbers`](../../operations/classes/RemoveLineNumbers.md)
- [`RemoveNullBytes`](../../operations/classes/RemoveNullBytes.md)
- [`RemoveWhitespace`](../../operations/classes/RemoveWhitespace.md)
- [`Reverse`](../../operations/classes/Reverse.md)
- [`ROT13`](../../operations/classes/ROT13.md)
- [`ROT47`](../../operations/classes/ROT47.md)
- [`Salsa20`](../../operations/classes/Salsa20.md)
- [`Scrypt`](../../operations/classes/Scrypt.md)
- [`SetDifference`](../../operations/classes/SetDifference.md)
- [`SetIntersection`](../../operations/classes/SetIntersection.md)
- [`SetUnion`](../../operations/classes/SetUnion.md)
- [`SHA0`](../../operations/classes/SHA0.md)
- [`SHA1`](../../operations/classes/SHA1.md)
- [`SHA2`](../../operations/classes/SHA2.md)
- [`SHA3`](../../operations/classes/SHA3.md)
- [`Shake`](../../operations/classes/Shake.md)
- [`ShowBase64Offsets`](../../operations/classes/ShowBase64Offsets.md)
- [`Shuffle`](../../operations/classes/Shuffle.md)
- [`Sleep`](../../operations/classes/Sleep.md)
- [`SM2Decrypt`](../../operations/classes/SM2Decrypt.md)
- [`SM2Encrypt`](../../operations/classes/SM2Encrypt.md)
- [`SM3`](../../operations/classes/SM3.md)
- [`SM4Decrypt`](../../operations/classes/SM4Decrypt.md)
- [`SM4Encrypt`](../../operations/classes/SM4Encrypt.md)
- [`Snefru`](../../operations/classes/Snefru.md)
- [`Sort`](../../operations/classes/Sort.md)
- [`Split`](../../operations/classes/Split.md)
- [`SQLBeautify`](../../operations/classes/SQLBeautify.md)
- [`SQLMinify`](../../operations/classes/SQLMinify.md)
- [`SSDEEP`](../../operations/classes/SSDEEP.md)
- [`StandardDeviation`](../../operations/classes/StandardDeviation.md)
- [`Streebog`](../../operations/classes/Streebog.md)
- [`Strings`](../../operations/classes/Strings.md)
- [`StripHTMLTags`](../../operations/classes/StripHTMLTags.md)
- [`StripHTTPHeaders`](../../operations/classes/StripHTTPHeaders.md)
- [`StripIPv4Header`](../../operations/classes/StripIPv4Header.md)
- [`StripTCPHeader`](../../operations/classes/StripTCPHeader.md)
- [`StripUDPHeader`](../../operations/classes/StripUDPHeader.md)
- [`SUB`](../../operations/classes/SUB.md)
- [`Subsection`](../../operations/classes/Subsection.md)
- [`Substitute`](../../operations/classes/Substitute.md)
- [`Subtract`](../../operations/classes/Subtract.md)
- [`Sum`](../../operations/classes/Sum.md)
- [`SwapCase`](../../operations/classes/SwapCase.md)
- [`SwapEndianness`](../../operations/classes/SwapEndianness.md)
- [`SymmetricDifference`](../../operations/classes/SymmetricDifference.md)
- [`SyntaxHighlighter`](../../operations/classes/SyntaxHighlighter.md)
- [`Tail`](../../operations/classes/Tail.md)
- [`TakeBytes`](../../operations/classes/TakeBytes.md)
- [`TakeNthBytes`](../../operations/classes/TakeNthBytes.md)
- [`ToBase32`](../../operations/classes/ToBase32.md)
- [`ToBase45`](../../operations/classes/ToBase45.md)
- [`ToBase58`](../../operations/classes/ToBase58.md)
- [`ToBase62`](../../operations/classes/ToBase62.md)
- [`ToBase85`](../../operations/classes/ToBase85.md)
- [`ToBase92`](../../operations/classes/ToBase92.md)
- [`ToBCD`](../../operations/classes/ToBCD.md)
- [`ToBech32`](../../operations/classes/ToBech32.md)
- [`ToBinary`](../../operations/classes/ToBinary.md)
- [`ToBraille`](../../operations/classes/ToBraille.md)
- [`ToCamelCase`](../../operations/classes/ToCamelCase.md)
- [`ToCaseInsensitiveRegex`](../../operations/classes/ToCaseInsensitiveRegex.md)
- [`ToCharcode`](../../operations/classes/ToCharcode.md)
- [`ToDecimal`](../../operations/classes/ToDecimal.md)
- [`ToFloat`](../../operations/classes/ToFloat.md)
- [`ToHex`](../../operations/classes/ToHex.md)
- [`ToHexContent`](../../operations/classes/ToHexContent.md)
- [`ToHexdump`](../../operations/classes/ToHexdump.md)
- [`ToHTMLEntity`](../../operations/classes/ToHTMLEntity.md)
- [`ToKebabCase`](../../operations/classes/ToKebabCase.md)
- [`ToLowerCase`](../../operations/classes/ToLowerCase.md)
- [`ToMorseCode`](../../operations/classes/ToMorseCode.md)
- [`ToOctal`](../../operations/classes/ToOctal.md)
- [`ToPunycode`](../../operations/classes/ToPunycode.md)
- [`ToQuotedPrintable`](../../operations/classes/ToQuotedPrintable.md)
- [`ToSnakeCase`](../../operations/classes/ToSnakeCase.md)
- [`ToTable`](../../operations/classes/ToTable.md)
- [`ToUNIXTimestamp`](../../operations/classes/ToUNIXTimestamp.md)
- [`ToUpperCase`](../../operations/classes/ToUpperCase.md)
- [`TranslateDateTimeFormat`](../../operations/classes/TranslateDateTimeFormat.md)
- [`TripleDESDecrypt`](../../operations/classes/TripleDESDecrypt.md)
- [`TripleDESEncrypt`](../../operations/classes/TripleDESEncrypt.md)
- [`UnescapeString`](../../operations/classes/UnescapeString.md)
- [`UnescapeUnicodeCharacters`](../../operations/classes/UnescapeUnicodeCharacters.md)
- [`UnicodeTextFormat`](../../operations/classes/UnicodeTextFormat.md)
- [`Unique`](../../operations/classes/Unique.md)
- [`UNIXTimestampToWindowsFiletime`](../../operations/classes/UNIXTimestampToWindowsFiletime.md)
- [`Untar`](../../operations/classes/Untar.md)
- [`Unzip`](../../operations/classes/Unzip.md)
- [`URLDecode`](../../operations/classes/URLDecode.md)
- [`URLEncode`](../../operations/classes/URLEncode.md)
- [`VarIntDecode`](../../operations/classes/VarIntDecode.md)
- [`VarIntEncode`](../../operations/classes/VarIntEncode.md)
- [`Whirlpool`](../../operations/classes/Whirlpool.md)
- [`WindowsFiletimeToUNIXTimestamp`](../../operations/classes/WindowsFiletimeToUNIXTimestamp.md)
- [`Wrap`](../../operations/classes/Wrap.md)
- [`XKCDRandomNumber`](../../operations/classes/XKCDRandomNumber.md)
- [`XMLBeautify`](../../operations/classes/XMLBeautify.md)
- [`XMLMinify`](../../operations/classes/XMLMinify.md)
- [`XOR`](../../operations/classes/XOR.md)
- [`XORBruteForce`](../../operations/classes/XORBruteForce.md)
- [`XORChecksum`](../../operations/classes/XORChecksum.md)
- [`XPathExpression`](../../operations/classes/XPathExpression.md)
- [`XSalsa20`](../../operations/classes/XSalsa20.md)
- [`Zip`](../../operations/classes/Zip.md)
- [`ZlibDeflate`](../../operations/classes/ZlibDeflate.md)
- [`ZlibInflate`](../../operations/classes/ZlibInflate.md)

## Constructors

### Constructor

> **new Operation**(): `Operation`

#### Returns

`Operation`

## Properties

### args

> **args**: [`ArgConfig`](../interfaces/ArgConfig.md)[] = `[]`

Defined in: [Operation.ts:74](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L74)

List of arguments the operation accepts.

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

***

### description

> **description**: `string` = `""`

Defined in: [Operation.ts:60](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L60)

Human-readable description of what the operation does.

***

### flowControl

> **flowControl**: `boolean` = `false`

Defined in: [Operation.ts:70](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L70)

Whether the operation supports flow control.

***

### infoURL

> **infoURL**: `string` \| `null` = `null`

Defined in: [Operation.ts:62](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L62)

Optional URL for more information about the operation or algorithm.

***

### inputType

> **inputType**: `string` = `"string"`

Defined in: [Operation.ts:64](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L64)

Expected input data type.

***

### manualBake

> **manualBake**: `boolean` = `false`

Defined in: [Operation.ts:72](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L72)

Whether the operation requires manual triggering.

***

### module

> **module**: `string` = `""`

Defined in: [Operation.ts:58](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L58)

Category or module the operation belongs to.

***

### name

> **name**: `string` = `""`

Defined in: [Operation.ts:56](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L56)

Internal name of the operation.

***

### outputType

> **outputType**: `string` = `"string"`

Defined in: [Operation.ts:66](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L66)

Expected output data type.

***

### presentType

> **presentType**: `string` = `"string"`

Defined in: [Operation.ts:68](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L68)

Type for presentation purposes.

## Methods

### highlight()

> **highlight**(`_pos`, `_args`): [`HighlightResult`](../type-aliases/HighlightResult.md)

Defined in: [Operation.ts:104](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L104)

Calculates highlight ranges based on input selection.

#### Parameters

##### \_pos

[`HighlightPos`](../type-aliases/HighlightPos.md)

##### \_args

`any`[]

#### Returns

[`HighlightResult`](../type-aliases/HighlightResult.md)

***

### highlightReverse()

> **highlightReverse**(`_pos`, `_args`): [`HighlightResult`](../type-aliases/HighlightResult.md)

Defined in: [Operation.ts:112](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L112)

Calculates highlight ranges in the input based on output selection.

#### Parameters

##### \_pos

[`HighlightPos`](../type-aliases/HighlightPos.md)

##### \_args

`any`[]

#### Returns

[`HighlightResult`](../type-aliases/HighlightResult.md)

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

***

### run()

> `abstract` **run**(`input`, `args`): `any`

Defined in: [Operation.ts:86](https://github.com/MichaelWeissDEV/ts-chef/blob/3a666cf265e3ec13756556c8404eca75c1140fed/src/chef/Operation.ts#L86)

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
