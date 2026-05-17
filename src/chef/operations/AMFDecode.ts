/*
 * -----------------------------------------------------------------------------
 * Project:     ts-chef
 * Model:       Qwen 3.5 Coder Next (Local)
 * Version:     1.0.0
 * Author:      Michael Weiss
 * Source:      Ported from GCHQ's CyberChef (JavaScript)
 * License:     Apache License 2.0
 * Description: TypeScript implementation of CyberChef modules.
 * Note:        First Port done by Local Model, Cleanup and fixes by Author
 * -----------------------------------------------------------------------------
 */

import Operation from "../Operation";
import "reflect-metadata"; // Required as a shim for the amf library
import { AMF0, AMF3 } from "@astronautlabs/amf";

/**
 * AMF Decode operation
 */
export class AMFDecode extends Operation {
    /**
     * AMFDecode constructor
     */
    constructor() {
        super();

        this.name = "AMF Decode";
        this.module = "Encodings";
        this.description =
            "Action Message Format (AMF) is a binary format used to serialize object graphs such as ActionScript objects and XML, or send messages between an Adobe Flash client and a remote service, usually a Flash Media Server or third party alternatives.";
        this.infoURL = "https://wikipedia.org/wiki/Action_Message_Format";
        this.inputType = "ArrayBuffer";
        this.outputType = "JSON";
        this.args = [
            {
                name: "Format",
                type: "option",
                value: ["AMF0", "AMF3"],
                defaultIndex: 1,
            },
        ];
    }

    /**
     * @param {ArrayBuffer} input
     * @param {any[]} args
     * @returns {any}
     */
    run(input: ArrayBuffer, args: any[]): any {
        const format = args[0];
        const handler = format === "AMF0" ? AMF0 : AMF3;
        const encoded = new Uint8Array(input);
        return handler.Value.deserialize(encoded);
    }
}

export default AMFDecode;
