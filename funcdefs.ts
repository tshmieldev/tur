interface RecLangFuncCtx {
    variables: Map<string, any>;
    eip: number;
}
export const funcs = (ctx: RecLangFuncCtx) => ({
    '$add': {
        fn(a: number, b: number) { return a + b; },
    },
    '$sub': {
        fn(a: number, b: number) { return a - b; },
    },
    '$mul': {
        fn(a: number, b: number) { return a * b; },
    },
    '$div': {
        fn(a: number, b: number) { return a / b; },
    },
    '$eq': {
        fn(a: any, b: any) { return a === b; },
    },
    '$neq': {
        fn(a: any, b: any) { return a !== b; },
    },
    '$gt': {
        fn(a: number, b: number) { return a > b; },
    },
    '$lt': {
        fn(a: number, b: number) { return a < b; },
    },
    '$gte': {
        fn(a: number, b: number) { return a >= b; },
    },
    '$lte': {
        fn(a: number, b: number) { return a <= b; },
    },
    '$neg': {
        fn(a: number) { return -a; },
    },
    '$print': {
        fn(...args: any[]) { Deno.stdout.writeSync(new TextEncoder().encode(args.join(' '))); },
    },
    '$println': {
        fn(...args: any[]) { console.log(...args); },
    },
    '$set': {
        fn(name: string, value: any) { ctx.variables.set(name, value); },
    },
    '$get': {
        fn(name: string) { return ctx.variables.get(name); },
    },
    '$ref': {
        fn(name: string) {
            if(!ctx.variables.has(name)) {
                // default init
                ctx.variables.set(name, null);
            }
            // Name is the reference to the variable
            return name;
        }
    },
    '$return': {
        fn(value?: any) {
            throw { type: 'return', value };
        }
    },
    '$goto': {
        fn(ln: number) {
            ctx.eip = ln-2; // -1 for next increment, -1 for 0-based index
        }
    },
    '$if': {
        fn(cond: boolean, ln: number) {
            if(cond) {
                ctx.eip = ln-2;
            }
        }
    },
    '$read': {
        fn() {
            const buf = new Uint8Array(1024);
            const n = Deno.stdin.readSync(buf);
            if(n === null) {
                return '';
            }
            let res = new TextDecoder().decode(buf.subarray(0, n)).trim();
            let numres = Number(res);
            if(!isNaN(numres)) {
                return numres;
            }
            return res;
        },
    },
        '$catFact': {
        async fn() {
            const resp = await fetch('https://catfact.ninja/fact');
            if(!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            const data = await resp.json();
            return data.fact;   
        }
    }
    
   
})