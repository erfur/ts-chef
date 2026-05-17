export const DISH_TYPES = {
    ARRAY_BUFFER: 0,
    STRING: 1,
    NUMBER: 2,
    HTML: 3,
    JSON: 4,
    FILE: 5,
    LIST_FILE: 6,
    BIG_NUMBER: 7,
} as const;

export type DishType = typeof DISH_TYPES[keyof typeof DISH_TYPES];

class Dish {
    value: unknown = new ArrayBuffer(0);
    type: DishType = DISH_TYPES.ARRAY_BUFFER;

    static readonly ARRAY_BUFFER = DISH_TYPES.ARRAY_BUFFER;
    static readonly STRING = DISH_TYPES.STRING;
    static readonly NUMBER = DISH_TYPES.NUMBER;
    static readonly HTML = DISH_TYPES.HTML;
    static readonly JSON = DISH_TYPES.JSON;
    static readonly FILE = DISH_TYPES.FILE;
    static readonly LIST_FILE = DISH_TYPES.LIST_FILE;
    static readonly BIG_NUMBER = DISH_TYPES.BIG_NUMBER;

    constructor(value?: unknown, type?: DishType) {
        if (value !== undefined && type !== undefined) {
            this.set(value, type);
        } else if (value !== undefined) {
            this.set(value, DISH_TYPES.STRING);
        }
    }

    set(value: unknown, type: DishType | string): void {
        this.value = value;
        if (typeof type === "number") {
            this.type = type;
        }
    }

    async get(type: DishType | string): Promise<unknown> {
        return this.value;
    }

    async present(): Promise<string> {
        if (this.value === null || this.value === undefined) return "";
        if (typeof this.value === "string") return this.value;
        if (this.value instanceof ArrayBuffer) {
            return new TextDecoder().decode(this.value);
        }
        return String(this.value);
    }

    clone(): Dish {
        const d = new Dish();
        d.value = this.value;
        d.type = this.type;
        return d;
    }
}

export default Dish;
