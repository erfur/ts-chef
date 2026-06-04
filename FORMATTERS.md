# ts-chef Formatters Documentation

This document describes the code beautifiers, minifiers, and formatters available in ts-chef.

## Table of Contents
- [Beautifiers](#beautifiers)
  - [JSON Beautify](#json-beautify)
  - [XML Beautify](#xml-beautify)
  - [CSS Beautify](#css-beautify)
  - [SQL Beautify](#sql-beautify)
  - [JavaScript Beautify](#javascript-beautify)
  - [Generic Code Beautify](#generic-code-beautify)
- [Minifiers](#minifiers)
  - [JSON Minify](#json-minify)
  - [CSS Minify](#css-minify)
  - [SQL Minify](#sql-minify)
  - [JavaScript Minify](#javascript-minify)
- [Other Formatters](#other-formatters)
  - [Format MAC Addresses](#format-mac-addresses)
  - [Add Line Numbers](#add-line-numbers)

---

## Beautifiers

### JSON Beautify
Formats JSON data with consistent indentation and spacing.
- **Input:** JSON string
- **Arguments:**
  - `Indent`: Number of spaces or tabs to use for indentation.

### XML Beautify
Formats XML data by adding indentation and line breaks between tags.
- **Input:** XML string
- **Arguments:**
  - `Indent`: Number of spaces or tabs.

### CSS Beautify
Formats CSS rules for better readability.
- **Input:** CSS string

### SQL Beautify
Formats SQL queries (SELECT, INSERT, UPDATE, etc.) for better readability.
- **Input:** SQL string

### JavaScript Beautify
Formats JavaScript/TypeScript code using standard indentation and bracing styles.
- **Input:** JavaScript string

### Generic Code Beautify
A basic beautifier for languages not covered by specialized formatters.

---

## Minifiers

### JSON Minify
Removes all unnecessary whitespace and comments from JSON data.

### CSS Minify
Removes whitespace and comments from CSS to reduce file size.

### SQL Minify
Removes comments and extra whitespace from SQL queries.

### JavaScript Minify
Minifies JavaScript code by removing whitespace and comments.

---

## Other Formatters

### Format MAC Addresses
Formats a list of MAC addresses using various delimiters (colon, dash, none).

### Add Line Numbers
Adds line numbers to the beginning of each line in the input.
