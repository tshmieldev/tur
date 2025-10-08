/*

$add: [R][R] -> [R]
$sub: [R][R] -> [R]
$mul: [R][R] -> [R]
$div: [R][R] -> [R] THROWS
$divint: [R][R] -> [R] THROWS
$mod: [R][R] -> [R] THROWS
$neg: [R] -> [R]

$lt: [R][R] -> [R]
$le: [R][R] -> [R]
$gt: [R][R] -> [R]
$ge: [R][R] -> [R]
$eq: [R][R] -> [R]
$neq: [R][R] -> [R]

$toint: [R] -> [R] THROWS // Guarantees that if no throw, the result is an integer
$tofloat: [R] -> [R] THROWS // Guarantees that if no throw, the result is a float

$read: [] -> [R]
$print: [R]+ -> []
$println: [R]+ -> []

$catFact: [] -> [R] THROWS
$randInt: [R][R] -> [R] THROWS
$randFloat: [R][R] -> [R] THROWS

$if: [R][R] -> []
$goto: [R] -> []
$label: [R] -> []
$return: [R]? -> []

$set: [L][R] -> []
$get: [L] -> [R]
$ref: [L] -> [L]

L is also R

*/

class TreeNode {
    args: (TreeNode | string)[];
    command: string;

    constructor(command: string) {
        this.command = command;
        this.args = [];
    }
}

// This must be run in Deno
const { args } = Deno;
if (args.length < 1) { console.log("Usage: deno run --allow-read --allow-write --allow-net parse.ts <source-file>"); Deno.exit(1); }
const dumpAST = (args.includes('-d') || args.includes('--dump'));
const loud = (args.includes('-l') || args.includes('--loud'));
const sourceFile = args[0];

let source: string;

try {
    source = await Deno.readTextFile(sourceFile);
} catch (e) {
    console.error(`Error reading file ${sourceFile}: ${e}`);
    Deno.exit(1);
}

const lines = source.split('\n');

type VType = 'R' | 'L';

interface Command {
    instruction: string;
    args: VType[];
    throws: boolean;
    returnType: VType | null;
    async?: boolean;
    infiniteArgs?: boolean;
    allowNoArgs?: boolean;
}

const commands = new Map<string, Command>();

commands.set('$add', { instruction: '$add', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$sub', { instruction: '$sub', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$mul', { instruction: '$mul', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$div', { instruction: '$div', args: ['R', 'R'], throws: true, returnType: 'R' });
commands.set('$divint', { instruction: '$divint', args: ['R', 'R'], throws: true, returnType: 'R' });
commands.set('$mod', { instruction: '$mod', args: ['R', 'R'], throws: true, returnType: 'R' });
commands.set('$neg', { instruction: '$neg', args: ['R'], throws: false, returnType: 'R' });

commands.set('$lt', { instruction: '$lt', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$le', { instruction: '$le', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$gt', { instruction: '$gt', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$ge', { instruction: '$ge', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$eq', { instruction: '$eq', args: ['R', 'R'], throws: false, returnType: 'R' });
commands.set('$neq', { instruction: '$neq', args: ['R', 'R'], throws: false, returnType: 'R' });

commands.set('$toint', { instruction: '$toint', args: ['R'], throws: true, returnType: 'R' });
commands.set('$tofloat', { instruction: '$tofloat', args: ['R'], throws: true, returnType: 'R' });

commands.set('$read', { instruction: '$read', args: [], allowNoArgs: true, throws: false, returnType: 'R' });
commands.set('$print', { instruction: '$print', args: ['R'], infiniteArgs: true, throws: false, returnType: null });
commands.set('$println', { instruction: '$println', args: ['R'], allowNoArgs: true, infiniteArgs: true, throws: false, returnType: null });

commands.set('$catFact', { instruction: '$catFact', args: [], throws: true, returnType: 'R', async: true });
commands.set('$randInt', { instruction: '$randInt', args: ['R', 'R'], throws: true, returnType: 'R' });
commands.set('$randFloat', { instruction: '$randFloat', args: ['R', 'R'], throws: true, returnType: 'R' });

commands.set('$if', { instruction: '$if', args: ['R', 'R'], throws: false, returnType: null });
commands.set('$goto', { instruction: '$goto', args: ['R'], throws: false, returnType: null });
commands.set('$label', { instruction: '$label', args: ['R'], throws: false, returnType: null });
commands.set('$return', { instruction: '$return', args: ['R'], allowNoArgs: true, throws: false, returnType: null });

commands.set('$set', { instruction: '$set', args: ['L', 'R'], throws: false, returnType: null });
commands.set('$get', { instruction: '$get', args: ['R'], throws: false, returnType: 'R' });
commands.set('$ref', { instruction: '$ref', args: ['R'], throws: true, returnType: 'L' });

const astLog: (TreeNode|string)[] = [];

for(let p = 0; p < lines.length; p++) {
    const line = lines[p];
    const trimmed = line.trim();
    if(trimmed === '') {astLog.push(''); continue;} // empty line
    const instruction = trimmed.substring(0, trimmed.indexOf(';') === -1 ? trimmed.length : trimmed.indexOf('//')).trim();
    if(instruction === '') {astLog.push(''); continue;};
    const parts = instruction.split(' ');

    
    // Example:
    // line = "$if $eq $add $get x $get y 69 20"
    // meaning if ( (x + y) == 69 ) goto 20
    // Strategy for parsing:
    // 1. Read the command ($if)
    // 2. Read the args ($eq, $add, $get, x, $get, y, 69, 20)
    // 3. For each arg, if it's a command, recursively parse its args until we reach non-command args
    // 4. Validate the types and number of args against the command definition

    const commandName = parts[0];
    const commandDef = commands.get(commandName);
    if(!commandDef) {
        console.error(`Unknown command: ${commandName}`);
        Deno.exit(1);
    }

    const rootNode = new TreeNode(commandName);
    const stack = [{
        node: rootNode,
        expectedArgs: commandDef.args,
        infiniteArgs: commandDef.infiniteArgs || false,
        allowNoArgs: commandDef.allowNoArgs || false,
        argsSoFar: [] as any[],
        argptr: 0
    }]
   
    let i = 1;
    while(i < parts.length) {
        const current = stack[stack.length - 1];
        if(!current) {
            console.error(`Error parsing line: ${line} - too many arguments?`);
            Deno.exit(1);
        }
        if(current.argptr >= current.expectedArgs.length && !current.infiniteArgs) {
            console.error(`Too many arguments for command ${current.node.command}`);
            Deno.exit(1);
        }
        const part = parts[i];
        const partCommandDef = commands.get(part);
        if(partCommandDef) {
            // It's a command, create a new node and push to stack
            stack.push({
                node: new TreeNode(part),
                expectedArgs: partCommandDef.args,
                infiniteArgs: partCommandDef.infiniteArgs || false,
                allowNoArgs: partCommandDef.allowNoArgs || false,
                argsSoFar: [],
                argptr: 0
            });
            i++;
        } else {
            // It's a value, check type
            const expectedType = current.expectedArgs[
                current.infiniteArgs
                    ? Math.min(current.argptr, current.expectedArgs.length - 1)
                    : current.argptr
            ];
            const argType: VType = 'R';

            // Type enforcement: L can be used as R, but not vice versa
            if(expectedType === 'L') {
                console.error(`Type error: expected L but got R ('${part}') for command ${current.node.command}`);
                Deno.exit(1);
            }
            if(expectedType === 'R' && argType !== 'R' && argType !== 'L') {
                console.error(`Type error: expected R but got ${argType} ('${part}') for command ${current.node.command}`);
                Deno.exit(1);
            }

            current.node.args.push(part);
            current.argsSoFar.push(part);
            current.argptr++;
            i++;
        }
        // If current node has all its args, pop it from stack and add to parent
        while(stack.length > 0) {
            const top = stack[stack.length - 1];
            if(top.argptr >= top.expectedArgs.length && !top.infiniteArgs) {
                stack.pop();
                if(stack.length === 0) break;
                const parent = stack[stack.length - 1];
                parent.node.args.push(top.node);
                parent.argsSoFar.push(top.node.command);
                parent.argptr++;
            } else {
                break;
            }
        }
    }

    if(stack.length > 0) {
        const unfinished = stack[stack.length - 1];
        if(unfinished.allowNoArgs && unfinished.argsSoFar.length === 0 || unfinished.infiniteArgs && unfinished.argptr) {
            stack.pop();
            if(stack.length > 0) {
                const parent = stack[stack.length - 1];
                parent.node.args.push(unfinished.node);
                parent.argsSoFar.push(unfinished.node.command);
                parent.argptr++;
            }
        } else {
            console.error(`Not enough arguments for command ${unfinished.node.command}`);
            Deno.exit(1);
        }
    }

    if(stack.length !== 0) {
        console.error(`Error parsing line: ${line}`);
        Deno.exit(1);
    }

  

    if(dumpAST)
        astLog.push(rootNode)
    if(loud) {
        console.log('Successfully parsed line: ', p+1);
    }
}

if(dumpAST) {
    Deno.writeTextFileSync(`${sourceFile}-ast.json`, JSON.stringify(astLog, null, 2));
    if(loud)
        console.log(`AST dumped to ${sourceFile}-ast.json`);
}