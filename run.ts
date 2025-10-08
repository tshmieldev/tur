import { funcs } from './funcdefs.ts';

if(Deno.args.length < 1) {
    console.error('Usage: deno run --allow-read run.ts <file>');
    Deno.exit(1);
}

const filename = Deno.args[0];
let fileData: Uint8Array;
try {
    fileData = Deno.readFileSync(filename)
} catch (e) {
    console.error(`Error reading file ${filename}: ${e}`);
    Deno.exit(1);
}

const ast = JSON.parse(new TextDecoder().decode(fileData));

const variables: Map<string, any> = new Map();
variables.set('_', '') // Used for ' '

type funcNames = '$if' | '$goto' | '$add' | '$sub' | '$mul' | '$div' | '$eq' | '$neq' | '$gt' | '$lt' | '$gte' | '$lte' | '$neg' | '$print' | '$println' | '$set' | '$get' | '$ref' | '$return';

interface AstNode {
    command: funcNames;
    args: (AstNode | string)[];
}
const evalArg = async (arg: AstNode | string, fctx: any): Promise<any> => {
    if (typeof arg === 'string') {
        arg = arg.trim()
        return isNaN(Number(arg)) ? arg : Number(arg);
    }
    // Do not mutate the original AST node
    const evaluatedArgs = await Promise.all(arg.args.map(a => evalArg(a, fctx)));
    return await fctx[arg.command].fn(...evaluatedArgs);
}
const ctx = { variables, eip: 0 };
const fctx = funcs(ctx);
try {
while(ctx.eip < ast.length) {
    // console.log('EIP:', ctx.eip, ast[ctx.eip]);
    const line = ast[ctx.eip];
    await evalArg(line, fctx);
    ctx.eip++;
    
} } catch(e:any) {
    if (e?.type == 'return') {
        console.log('Program returned:', e.value);
    }
}